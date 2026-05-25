export interface TourPassengerDto {
  firstName: string;
  lastName: string;
  documentNumber: string;
  documentType?: string;
}

export interface CrearReservaAtraccionExternaDto {
  slotId: string;
  attractionId: string;
  productOptionId: string;
  contactName?: string;
  contactEmail?: string;
  passengers: TourPassengerDto[];
}
