export type ISODateTime = string;

export interface IRestaurant {
  id: string;
  name: string;
  timezone: string;
  windows?: Array<{ start: string; end: string }>;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ISector {
  id: string;
  restaurantId: string;
  name: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ITable {
  id: string;
  sectorId: string;
  name: string;
  minSize: number;
  maxSize: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type TypeBookingStatus = 'CONFIRMED' | 'CANCELLED';

export interface IBooking {
  id: string;
  restaurantId: string;
  sectorId: string;
  tableIds: string[]; // single or combo (any length)
  partySize: number;
  start: ISODateTime; // [start,end)
  end: ISODateTime;
  durationMinutes: number;
  status: TypeBookingStatus;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}
