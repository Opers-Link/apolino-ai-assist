import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SimulationInput {
  propertyValue: number;
  downPayment: number;
  termMonths: number;
  grossIncome: number;
  propertyType: "novo" | "usado";
  firstProperty: boolean;
  fgtsAmount?: number;
}

interface BankRate {
  id: string;
  bank_name: string;
  bank_code: string;
  modality: string;
  min_rate: number;
  max_rate: number;
  max_ltv: number;
  max_term_months: number;
  max_income_ratio: number;
  min_property_value: number;
  max_property_value: number | null;
  insurance_rate: number;
  admin_fee: number;
  notes: string;
}

interface BankSimulation {
  bankName: string;
  bankCode: string;
  modality: string;
  annualRate: number;
  monthlyRate: number;
  financedAmount: number;
  termMonths: number;
  sac: {
    firstInstallment: number;
    lastInstallment: number;
    totalPaid: number;
    averageInstallment: number;
  };
  price: {
    fixedInstallment: number;
    totalPaid: number;
  };
  maxInstallment: number;
  incomeApproved: boolean;
  insuranceMonthly: number;
  adminFee: number;
  notes: string;
}

function calculateSAC(principal: number, monthlyRate: number, months: number, insuranceRate: number, adminFee: number) {
  const amortization = principal / months;
  let totalPaid = 0;
  let balance = principal;
  const firstInterest = balance * monthlyRate;
  const firstInsurance = balance * insuranceRate;
  const firstInstallment = amortization + firstInterest + firstInsurance + adminFee;

  for (let i = 0; i < months; i++) {
    const interest = balance * monthlyRate;
    const insurance = balance * insuranceRate;
    const installment = amortization + interest + insurance + adminFee;
    totalPaid += installment;
    balance -= amortization;
  }

  const lastInterest = (principal - amortization * (months - 1)) * monthlyRate;
  const lastInsurance = (principal - amortization * (months - 1)) * insuranceRate;
  const lastInstallment = amortization + lastInterest + lastInsurance + adminFee;

  return {
    firstInstallment: Math.round(firstInstallment * 100) / 100,
    lastInstallment: Math.round(lastInstallment * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    averageInstallment: Math.round((totalPaid / months) * 100) / 100,
  };
}

function calculatePrice(principal: number, monthlyRate: number, months: number, insuranceRate: number, adminFee: number) {
  const avgInsurance = (principal * insuranceRate + (principal / months) * insuranceRate) / 2;
  const pmt = principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  const fixedInstallment = pmt + avgInsurance + adminFee;
  return {
    fixedInstallment: Math.round(fixedInstallment * 100) / 100,
    totalPaid: Math.round(fixedInstallment * months * 100) / 100,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const input: SimulationInput = await req.json();
    const { propertyValue, downPayment, termMonths, grossIncome, propertyType, firstProperty, fgtsAmount = 0 } = input;

    if (!propertyValue || !downPayment || !termMonths || !grossIncome) {
      return new Response(JSON.stringify({ error: "Parâmetros obrigatórios: propertyValue, downPayment, termMonths, grossIncome" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const financedAmount = propertyValue - downPayment - fgtsAmount;
    const ltvRequested = financedAmount / propertyValue;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: rates, error } = await supabase
      .from("bank_rates")
      .select("*")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching rates:", error);
      return new Response(JSON.stringify({ error: "Erro ao buscar taxas bancárias" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const simulations: BankSimulation[] = [];

    for (const rate of rates as BankRate[]) {
      // Check property value range
      if (rate.min_property_value && propertyValue < rate.min_property_value) continue;
      if (rate.max_property_value && propertyValue > rate.max_property_value) continue;

      // Adjust LTV for property type and first property
      let effectiveMaxLtv = rate.max_ltv;
      if (propertyType === "novo" && rate.bank_code === "caixa" && rate.modality === "SBPE") {
        effectiveMaxLtv = 0.9;
      }
      if (firstProperty && rate.bank_code === "caixa") {
        effectiveMaxLtv = Math.min(effectiveMaxLtv + 0.05, 0.95);
      }

      // Check LTV
      if (ltvRequested > effectiveMaxLtv) continue;

      // Cap term
      const effectiveTerm = Math.min(termMonths, rate.max_term_months);

      // Use average rate for simulation
      const annualRate = (rate.min_rate + rate.max_rate) / 2;
      const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;

      const sac = calculateSAC(financedAmount, monthlyRate, effectiveTerm, rate.insurance_rate, rate.admin_fee);
      const price = calculatePrice(financedAmount, monthlyRate, effectiveTerm, rate.insurance_rate, rate.admin_fee);

      // Income check - max installment vs income ratio
      const maxInstallment = grossIncome * rate.max_income_ratio;
      const highestInstallment = Math.max(sac.firstInstallment, price.fixedInstallment);
      const incomeApproved = highestInstallment <= maxInstallment;

      simulations.push({
        bankName: rate.bank_name,
        bankCode: rate.bank_code,
        modality: rate.modality,
        annualRate,
        monthlyRate: Math.round(monthlyRate * 10000) / 10000,
        financedAmount,
        termMonths: effectiveTerm,
        sac,
        price,
        maxInstallment: Math.round(maxInstallment * 100) / 100,
        incomeApproved,
        insuranceMonthly: Math.round(financedAmount * rate.insurance_rate * 100) / 100,
        adminFee: rate.admin_fee,
        notes: rate.notes || "",
      });
    }

    // Sort by lowest SAC first installment
    simulations.sort((a, b) => a.sac.firstInstallment - b.sac.firstInstallment);

    return new Response(
      JSON.stringify({
        input: { propertyValue, downPayment, financedAmount, termMonths, grossIncome, propertyType, firstProperty, fgtsAmount },
        simulations,
        generatedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno no servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
