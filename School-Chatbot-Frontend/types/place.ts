export type CampusPlace = {
  id: number;
  place_name: string;
  building_type: string;
  services: string[];
  lat: number;
  lng: number;
  description?: string;
};

export type NavigationIntent = {
  intent: 'navigate';
  scope?: string;
  place_type?: string;
  target_service?: string;
  condition?: 'nearest' | 'none';
  matched_place_name?: string;
};
