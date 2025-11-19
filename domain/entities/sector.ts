import { ISODateTime, ISector as SectorInterface } from '../interfaces';

class Sector implements SectorInterface {
  public id: string;
  public restaurantId: string;
  public name: string;
  public createdAt: ISODateTime;
  public updatedAt: ISODateTime;

  private constructor(props: SectorInterface) {
    this.id = props.id;
    this.restaurantId = props.restaurantId;
    this.name = props.name;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(props: SectorInterface): Sector {
    return new Sector(props);
  }
}

export default Sector;
