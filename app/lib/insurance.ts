export type InsurancePlan = {
  id: string;
  name: string;
  category: "track" | "road";
  pricePerDay: number;
  deductible: number;
  coverageKey: string;
};

export const roadInsurancePlans: InsurancePlan[] = [
  {
    id: "road-basic",
    name: "Road Basic",
    category: "road",
    pricePerDay: 0,
    deductible: 2500,
    coverageKey: "insuranceRoadBasicCoverage",
  },
  {
    id: "road-plus",
    name: "Road Plus",
    category: "road",
    pricePerDay: 25,
    deductible: 1500,
    coverageKey: "insuranceRoadPlusCoverage",
  },
  {
    id: "road-premium",
    name: "Road Premium",
    category: "road",
    pricePerDay: 45,
    deductible: 900,
    coverageKey: "insuranceRoadPremiumCoverage",
  },
];

export const trackInsurancePlans: InsurancePlan[] = [
  {
    id: "track-basic",
    name: "Track Basic",
    category: "track",
    pricePerDay: 0,
    deductible: 7000,
    coverageKey: "insuranceTrackBasicCoverage",
  },
  {
    id: "track-plus",
    name: "Track Plus",
    category: "track",
    pricePerDay: 75,
    deductible: 5000,
    coverageKey: "insuranceTrackPlusCoverage",
  },
  {
    id: "track-cover",
    name: "Track Cover",
    category: "track",
    pricePerDay: 150,
    deductible: 3500,
    coverageKey: "insuranceTrackCoverCoverage",
  },
];

export function getInsurancePlans(trackAllowed: boolean) {
  return trackAllowed ? trackInsurancePlans : roadInsurancePlans;
}

export function findInsurancePlan(trackAllowed: boolean, planId: string) {
  return getInsurancePlans(trackAllowed).find((plan) => plan.id === planId);
}
