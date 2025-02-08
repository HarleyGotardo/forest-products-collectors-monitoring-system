export class CommonConstant {
  static DATE_FORMAT = {
    ISO_8601: "yyyy-MM-dd HH:mm:ss",
  };

  static SINGLE_STRING = {
    T: "Timber",
  };

  static MAP_ZOOM_LEVEL = {
    SIXTEEN: 16,
    NINETEEN: 19,
  };

  static INTEGERS = {
    ZERO: 0,
    TWO: 2,
  };

  static MAP_LAYER = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

  static COMPONENT_TEXTS = {
    CREATE_FOREST_PRODUCT: "Create Forest Product",
    DASHBOARD: "Dashboard",
    MAP: "Map",
    RECORDS: "Records",
    NAME: "Name",
    DESCRIPTION: "Description",
    TYPE: "Type",
    TIMBER: "Timber",
    NON_TIMBER: "Non-Timber",
    QUANTITY: "Quantity",
    LOCATION_NAME: "Location Name",
    COORDINATES: "Coordinates (Latitude, Longitude)",
    PRICE: "Price",
    CREATE: "Create",
    CANCEL: "Cancel",
    SAVE: "Save",
    UPDATE: "Update",
    SET: "Set",
    YOU_CLICKED_THE_MAP_AT: "You clicked the map at",
  };

  static SWAL = {
    ICON: "success",
    TITLE: "Success",
    TEXT_FORESTPRODUCT: "Forest product created successfully!",
    TEXT_LOCATION: "Location created successfully!",
    TIMER: 2000,
    SHOW_CONFIRM_BUTTON: false,
  };
}
