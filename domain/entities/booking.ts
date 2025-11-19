import { IBooking as BookingInterface, ISODateTime, TypeBookingStatus } from '../interfaces';

class Booking implements BookingInterface {
  public id: string;
  public restaurantId: string;
  public sectorId: string;
  public tableIds: string[];
  public partySize: number;
  public start: ISODateTime;
  public end: ISODateTime;
  public durationMinutes: number;
  public status: TypeBookingStatus;
  public createdAt: ISODateTime;
  public updatedAt: ISODateTime;

  constructor(props: BookingInterface) {
    this.id = props.id;
    this.restaurantId = props.restaurantId;
    this.sectorId = props.sectorId;
    this.tableIds = props.tableIds;
    this.partySize = props.partySize;
    this.start = props.start;
    this.end = props.end;
    this.durationMinutes = props.durationMinutes;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(props: BookingInterface): Booking {
    return new Booking(props);
  }
}

export default Booking;
