import _ from "lodash";

export const mapValuesDeep = <T>(
  v: T,
  callback: (value: unknown) => void,
): unknown =>
  _.isArray(v)
    ? v.map((v) => mapValuesDeep(v, callback))
    : _.isDate(v)
      ? callback(v)
      : _.isObject(v)
        ? _.mapValues(v, (v) => mapValuesDeep(v, callback))
        : callback(v);
