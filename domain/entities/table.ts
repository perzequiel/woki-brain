import { ISODateTime, ITable as TableInterface } from '../interfaces';

class Table implements TableInterface {
  public id: string;
  public sectorId: string;
  public name: string;
  public minSize: number;
  public maxSize: number;
  public createdAt: ISODateTime;
  public updatedAt: ISODateTime;

  private constructor(props: TableInterface) {
    this.id = props.id;
    this.sectorId = props.sectorId;
    this.name = props.name;
    this.minSize = props.minSize;
    this.maxSize = props.maxSize;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public static create(props: TableInterface): Table {
    return new Table(props);
  }
}

export default Table;
