declare module "jalaali-js" {
  /** Converts a Gregorian date to Jalaali. */
  function toJalaali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number }
  /** Converts a Jalaali date to Gregorian. */
  function toGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number }
  /** Checks if a Jalaali date is valid. */
  function isValidJalaaliDate(jy: number, jm: number, jd: number): boolean
  /** Checks if a Jalaali year is a leap year. */
  function isLeapJalaaliYear(jy: number): boolean
  /** Returns the number of days in a Jalaali month. */
  function jalaaliMonthLength(jy: number, jm: number): number
  /** Converts a Jalaali date to a Date object. */
  function jalaaliToDateObject(jy: number, jm: number, jd: number): Date

  export {
    toJalaali,
    toGregorian,
    isValidJalaaliDate,
    isLeapJalaaliYear,
    jalaaliMonthLength,
    jalaaliToDateObject,
  }
}
