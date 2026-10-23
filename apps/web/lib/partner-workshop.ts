export const workshopServices = [
  "Computer Diagnostics", "Engine Overhaul", "Brake & Suspension",
  "Tyres & Wheel Alignment", "Auto Electrical", "Mobile Roadside Unit"
] as const;

export interface WorkshopProfile {
  name: string;
  address: string;
  city: string;
  website: string;
  description: string;
  services: string[];
}

export interface WorkshopData {
  profile: WorkshopProfile;
  stats: { staff: number; supportTickets: number };
}
