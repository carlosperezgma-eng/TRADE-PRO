export type ReportType = 'degustacion' | 'amarre' | 'valor_agregado' | 'muestreo';

export const ZONES = [
  "ZONA SUR",
  "ZONA OESTE",
  "ZONA CIBAO-SANTIAGO",
  "ZONA ORIENTAL",
  "ZONA DISTRITO NACIONAL",
  "ZONA NORTE"
] as const;

export type Zone = typeof ZONES[number];

export interface Report {
  id: string;
  type: ReportType;
  storeName: string;
  productName: string;
  quantity: number;
  notes: string;
  timestamp: number;
  userId: string;
  userEmail?: string | null;
  userName?: string | null;
  zone?: Zone;
  peopleCount?: number;
  images?: string[];
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface DashboardStats {
  totalDegustaciones: number;
  totalPeopleCount: number;
  totalAmarres: number;
  totalMuestreos: number;
  totalValoresAgregados: number;
  storesVisited: number;
}
