import { ISODateTime, IRestaurant as RestaurantInterface } from '../interfaces';

class Restaurant implements RestaurantInterface {
  public id: string;
  public name: string;
  public timezone: string;
  public windows?: Array<{ start: string; end: string }>;
  public createdAt: ISODateTime;
  public updatedAt: ISODateTime;
  constructor(props: RestaurantInterface) {
    this.id = props.id;
    this.name = props.name;
    this.timezone = props.timezone;
    this.windows = props.windows;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
  public static create(props: RestaurantInterface): Restaurant {
    return new Restaurant(props);
  }
}

export default Restaurant;
