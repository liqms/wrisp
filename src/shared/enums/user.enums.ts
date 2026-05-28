/**
 * 用户相关枚举定义
 * 包含国家和地区、语言、时区等用户偏好设置相关的枚举
 */

/**
 * 国家和地区枚举
 * 基于ISO 3166-1标准，包含常用国家和地区
 */
export enum COUNTRY {
  // 亚洲
  CHINA = "中国",
  JAPAN = "日本",
  SOUTH_KOREA = "韩国",
  INDIA = "印度",
  SINGAPORE = "新加坡",
  MALAYSIA = "马来西亚",
  THAILAND = "泰国",
  VIETNAM = "越南",
  PHILIPPINES = "菲律宾",
  INDONESIA = "印度尼西亚",
  TAIWAN = "台湾地区",
  HONG_KONG = "香港地区",
  MACAO = "澳门地区",

  // 欧洲
  UNITED_KINGDOM = "英国",
  GERMANY = "德国",
  FRANCE = "法国",
  ITALY = "意大利",
  SPAIN = "西班牙",
  RUSSIA = "俄罗斯",
  NETHERLANDS = "荷兰",
  SWITZERLAND = "瑞士",
  SWEDEN = "瑞典",
  NORWAY = "挪威",
  FINLAND = "芬兰",
  DENMARK = "丹麦",
  POLAND = "波兰",

  // 北美洲
  UNITED_STATES = "美国",
  CANADA = "加拿大",
  MEXICO = "墨西哥",

  // 南美洲
  BRAZIL = "巴西",
  ARGENTINA = "阿根廷",
  CHILE = "智利",

  // 大洋洲
  AUSTRALIA = "澳大利亚",
  NEW_ZEALAND = "新西兰",

  // 非洲
  SOUTH_AFRICA = "南非",
  EGYPT = "埃及",
  NIGERIA = "尼日利亚",
  KENYA = "肯尼亚",
}

/**
 * 地区分组枚举
 * 用于将国家和地区按地理区域分组
 */
export enum REGION {
  ASIA = "亚洲",
  EUROPE = "欧洲",
  NORTH_AMERICA = "北美洲",
  SOUTH_AMERICA = "南美洲",
  OCEANIA = "大洋洲",
  AFRICA = "非洲",
}

/**
 * 语言枚举
 * 基于ISO 639-1标准，包含常用语言
 */
/**
 * 语言枚举
 * 基于ISO 639-1标准，包含常用语言
 */
export enum LANGUAGE {
  ZH_CN = "zh-CN", // 简体中文
  ZH_TW = "zh-TW", // 繁体中文
  EN_US = "en-US", // 美式英语
  EN_GB = "en-GB", // 英式英语
  JA_JP = "ja-JP", // 日语
  KO_KR = "ko-KR", // 韩语
  FR_FR = "fr-FR", // 法语
  DE_DE = "de-DE", // 德语
  ES_ES = "es-ES", // 西班牙语
  PT_BR = "pt-BR", // 巴西葡萄牙语
  RU_RU = "ru-RU", // 俄语
  AR_SA = "ar-SA", // 阿拉伯语
  HI_IN = "hi-IN", // 印地语

  // 其他常用语言
  IT_IT = "it-IT", // 意大利语
  NL_NL = "nl-NL", // 荷兰语
  SV_SE = "sv-SE", // 瑞典语
  PL_PL = "pl-PL", // 波兰语
  TR_TR = "tr-TR", // 土耳其语
  VI_VN = "vi-VN", // 越南语
  TH_TH = "th-TH", // 泰语
  ID_ID = "id-ID", // 印尼语
  MS_MY = "ms-MY", // 马来语
  FA_IR = "fa-IR", // 波斯语
}

/**
 * 常用时区枚举
 * 基于IANA时区数据库，包含常用时区
 */
export enum TIMEZONE {
  // 亚洲时区
  ASIA_SHANGHAI = "Asia/Shanghai", // 中国标准时间
  ASIA_TOKYO = "Asia/Tokyo", // 日本标准时间
  ASIA_SEOUL = "Asia/Seoul", // 韩国标准时间
  ASIA_SINGAPORE = "Asia/Singapore", // 新加坡时间
  ASIA_HONG_KONG = "Asia/Hong_Kong", // 香港时间
  ASIA_TAIPEI = "Asia/Taipei", // 台北时间
  ASIA_BANGKOK = "Asia/Bangkok", // 曼谷时间
  ASIA_KUALA_LUMPUR = "Asia/Kuala_Lumpur", // 吉隆坡时间
  ASIA_MANILA = "Asia/Manila", // 马尼拉时间
  ASIA_JAKARTA = "Asia/Jakarta", // 雅加达时间
  ASIA_DELHI = "Asia/Kolkata", // 印度标准时间

  // 欧洲时区
  EUROPE_LONDON = "Europe/London", // 伦敦时间
  EUROPE_PARIS = "Europe/Paris", // 巴黎时间
  EUROPE_BERLIN = "Europe/Berlin", // 柏林时间
  EUROPE_MOSCOW = "Europe/Moscow", // 莫斯科时间
  EUROPE_ROME = "Europe/Rome", // 罗马时间
  EUROPE_MADRID = "Europe/Madrid", // 马德里时间

  // 北美时区
  AMERICA_NEW_YORK = "America/New_York", // 纽约时间
  AMERICA_LOS_ANGELES = "America/Los_Angeles", // 洛杉矶时间
  AMERICA_CHICAGO = "America/Chicago", // 芝加哥时间
  AMERICA_TORONTO = "America/Toronto", // 多伦多时间
  AMERICA_MEXICO_CITY = "America/Mexico_City", // 墨西哥城时间

  // 南美时区
  AMERICA_SAO_PAULO = "America/Sao_Paulo", // 圣保罗时间
  AMERICA_BUENOS_AIRES = "America/Argentina/Buenos_Aires", // 布宜诺斯艾利斯时间

  // 大洋洲时区
  AUSTRALIA_SYDNEY = "Australia/Sydney", // 悉尼时间
  PACIFIC_AUCKLAND = "Pacific/Auckland", // 奥克兰时间

  // 非洲时区
  AFRICA_JOHANNESBURG = "Africa/Johannesburg", // 约翰内斯堡时间
  AFRICA_CAIRO = "Africa/Cairo", // 开罗时间
}

/**
 * 用户性别枚举
 */
export enum GENDER {
  MALE = "male",
  FEMALE = "female",
  OTHER = "other",
  PREFER_NOT_TO_SAY = "prefer_not_to_say",
}

/**
 * 用户角色枚举
 */
export enum USER_ROLE {
  ADMIN = "admin",
  USER = "user",
  GUEST = "guest",
  MODERATOR = "moderator",
  EDITOR = "editor",
}

/**
 * 用户状态枚举
 */
export enum USER_STATUS_ENUM {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
  BANNED = "banned",
  PENDING = "pending",
}

/**
 * 国家和地区信息接口
 */
export interface CountryInfo {
  code: string; // ISO 3166-1 alpha-2代码
  name: string; // 国家/地区名称
  nativeName: string; // 本地名称
  REGION: REGION; // 所属地区
  flag: string; // 国旗emoji
  phoneCode: string; // 国际电话区号
  currency: string; // 货币代码
  LANGUAGEs: LANGUAGE[]; // 官方语言
  timezones: TIMEZONE[]; // 主要时区
}

/**
 * 获取所有国家和地区信息
 */
export const Countries: Partial<Record<COUNTRY, CountryInfo>> = {
  [COUNTRY.CHINA]: {
    code: "CN",
    name: "中国",
    nativeName: "中国",
    REGION: REGION.ASIA,
    flag: "🇨🇳",
    phoneCode: "+86",
    currency: "CNY",
    LANGUAGEs: [LANGUAGE.ZH_CN],
    timezones: [TIMEZONE.ASIA_SHANGHAI],
  },
  [COUNTRY.JAPAN]: {
    code: "JP",
    name: "日本",
    nativeName: "日本",
    REGION: REGION.ASIA,
    flag: "🇯🇵",
    phoneCode: "+81",
    currency: "JPY",
    LANGUAGEs: [LANGUAGE.JA_JP],
    timezones: [TIMEZONE.ASIA_TOKYO],
  },
  [COUNTRY.SOUTH_KOREA]: {
    code: "KR",
    name: "韩国",
    nativeName: "대한민국",
    REGION: REGION.ASIA,
    flag: "🇰🇷",
    phoneCode: "+82",
    currency: "KRW",
    LANGUAGEs: [LANGUAGE.KO_KR],
    timezones: [TIMEZONE.ASIA_SEOUL],
  },
  [COUNTRY.UNITED_STATES]: {
    code: "US",
    name: "美国",
    nativeName: "United States",
    REGION: REGION.NORTH_AMERICA,
    flag: "🇺🇸",
    phoneCode: "+1",
    currency: "USD",
    LANGUAGEs: [LANGUAGE.EN_US],
    timezones: [TIMEZONE.AMERICA_NEW_YORK, TIMEZONE.AMERICA_LOS_ANGELES],
  },
  [COUNTRY.UNITED_KINGDOM]: {
    code: "GB",
    name: "英国",
    nativeName: "United Kingdom",
    REGION: REGION.EUROPE,
    flag: "🇬🇧",
    phoneCode: "+44",
    currency: "GBP",
    LANGUAGEs: [LANGUAGE.EN_GB],
    timezones: [TIMEZONE.EUROPE_LONDON],
  },
  [COUNTRY.GERMANY]: {
    code: "DE",
    name: "德国",
    nativeName: "Deutschland",
    REGION: REGION.EUROPE,
    flag: "🇩🇪",
    phoneCode: "+49",
    currency: "EUR",
    LANGUAGEs: [LANGUAGE.DE_DE],
    timezones: [TIMEZONE.EUROPE_BERLIN],
  },
  [COUNTRY.FRANCE]: {
    code: "FR",
    name: "法国",
    nativeName: "France",
    REGION: REGION.EUROPE,
    flag: "🇫🇷",
    phoneCode: "+33",
    currency: "EUR",
    LANGUAGEs: [LANGUAGE.FR_FR],
    timezones: [TIMEZONE.EUROPE_PARIS],
  },
  [COUNTRY.AUSTRALIA]: {
    code: "AU",
    name: "澳大利亚",
    nativeName: "Australia",
    REGION: REGION.OCEANIA,
    flag: "🇦🇺",
    phoneCode: "+61",
    currency: "AUD",
    LANGUAGEs: [LANGUAGE.EN_US],
    timezones: [TIMEZONE.AUSTRALIA_SYDNEY],
  },
};

/**
 * 按地区分组的国家和地区列表
 */
export const CountriesByRegion: Record<REGION, COUNTRY[]> = {
  [REGION.ASIA]: [
    COUNTRY.CHINA,
    COUNTRY.JAPAN,
    COUNTRY.SOUTH_KOREA,
    COUNTRY.INDIA,
    COUNTRY.SINGAPORE,
    COUNTRY.MALAYSIA,
    COUNTRY.THAILAND,
    COUNTRY.VIETNAM,
    COUNTRY.PHILIPPINES,
    COUNTRY.INDONESIA,
    COUNTRY.TAIWAN,
    COUNTRY.HONG_KONG,
    COUNTRY.MACAO,
  ],
  [REGION.EUROPE]: [
    COUNTRY.UNITED_KINGDOM,
    COUNTRY.GERMANY,
    COUNTRY.FRANCE,
    COUNTRY.ITALY,
    COUNTRY.SPAIN,
    COUNTRY.RUSSIA,
    COUNTRY.NETHERLANDS,
    COUNTRY.SWITZERLAND,
    COUNTRY.SWEDEN,
    COUNTRY.NORWAY,
    COUNTRY.FINLAND,
    COUNTRY.DENMARK,
    COUNTRY.POLAND,
  ],
  [REGION.NORTH_AMERICA]: [
    COUNTRY.UNITED_STATES,
    COUNTRY.CANADA,
    COUNTRY.MEXICO,
  ],
  [REGION.SOUTH_AMERICA]: [COUNTRY.BRAZIL, COUNTRY.ARGENTINA, COUNTRY.CHILE],
  [REGION.OCEANIA]: [COUNTRY.AUSTRALIA, COUNTRY.NEW_ZEALAND],
  [REGION.AFRICA]: [
    COUNTRY.SOUTH_AFRICA,
    COUNTRY.EGYPT,
    COUNTRY.NIGERIA,
    COUNTRY.KENYA,
  ],
};

/**
 * 工具函数：根据国家代码获取国家信息
 */
export function getCountryInfo(COUNTRY: COUNTRY): CountryInfo | undefined {
  return Countries[COUNTRY];
}

/**
 * 工具函数：根据地区获取国家和地区列表
 */
export function getCountriesByRegion(REGION: REGION): COUNTRY[] {
  return CountriesByRegion[REGION] || [];
}

/**
 * 工具函数：获取所有国家和地区列表
 */
export function getAllCountries(): COUNTRY[] {
  return Object.values(COUNTRY);
}

/**
 * 工具函数：根据国家名称搜索国家和地区
 */
export function searchCountries(query: string): COUNTRY[] {
  const lowerQuery = query.toLowerCase();
  return getAllCountries().filter(
    (COUNTRY) =>
      COUNTRY.toLowerCase().includes(lowerQuery) ||
      Countries[COUNTRY]?.nativeName.toLowerCase().includes(lowerQuery) ||
      Countries[COUNTRY]?.code.toLowerCase().includes(lowerQuery),
  );
}

/**
 * 工具函数：获取推荐的国家和地区列表
 * 基于用户IP地址或系统语言推荐
 */
export function getRecommendedCountries(): COUNTRY[] {
  // 默认推荐中国、美国、日本、韩国、英国
  return [
    COUNTRY.CHINA,
    COUNTRY.UNITED_STATES,
    COUNTRY.JAPAN,
    COUNTRY.SOUTH_KOREA,
    COUNTRY.UNITED_KINGDOM,
  ];
}

/**
 * 工具函数：验证国家/地区是否有效
 */
export function isValidCountry(COUNTRY: string): COUNTRY is COUNTRY {
  return Object.values(COUNTRY).includes(COUNTRY as COUNTRY);
}

/**
 * 工具函数：获取国家对应的默认时区
 */
export function getDefaultTimezoneForCountry(
  COUNTRY: COUNTRY,
): TIMEZONE | undefined {
  const COUNTRYInfo = getCountryInfo(COUNTRY);
  return COUNTRYInfo?.timezones[0];
}

/**
 * 工具函数：获取国家对应的主要语言
 */
export function getPrimaryLanguageForCountry(
  COUNTRY: COUNTRY,
): LANGUAGE | undefined {
  const COUNTRYInfo = getCountryInfo(COUNTRY);
  return COUNTRYInfo?.LANGUAGEs[0];
}

export default {
  COUNTRY,
  REGION,
  LANGUAGE,
  TIMEZONE,
  GENDER,
  USER_ROLE,
  Countries,
  CountriesByRegion,
  getCountryInfo,
  getCountriesByRegion,
  getAllCountries,
  searchCountries,
  getRecommendedCountries,
  isValidCountry,
  getDefaultTimezoneForCountry,
  getPrimaryLanguageForCountry,
};
