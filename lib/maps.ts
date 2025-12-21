/**
 * Coordinate Conversion Utility for China Maps
 * Handles WGS-84 (GPS) to GCJ-02 (Mars/China) conversion
 */

const PI = 3.1415926535897932384626;
const a = 6378245.0;
const ee = 0.00669342162296594323;

export function outOfChina(lat: number, lng: number): boolean {
    if (lng < 72.004 || lng > 137.8347) {
        return true;
    }
    if (lat < 0.8293 || lat > 55.8271) {
        return true;
    }
    return false;
}

function transformLat(x: number, y: number): number {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
    return ret;
}

function transformLng(x: number, y: number): number {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
    return ret;
}

/**
 * WGS-84 to GCJ-02
 */
export function wgs84ToGcj02(lat: number, lng: number): [number, number] {
    if (outOfChina(lat, lng)) {
        return [lat, lng];
    }
    let dLat = transformLat(lng - 105.0, lat - 35.0);
    let dLng = transformLng(lng - 105.0, lat - 35.0);
    const radLat = lat / 180.0 * PI;
    let magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI);
    dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI);
    const mgLat = lat + dLat;
    const mgLng = lng + dLng;
    return [mgLat, mgLng];
}

/**
 * GCJ-02 to BD-09 (Baidu)
 */
export function gcj02ToBd09(lat: number, lng: number): [number, number] {
    const x = lng, y = lat;
    const z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * PI * 3000.0 / 180.0);
    const theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * PI * 3000.0 / 180.0);
    const bdLng = z * Math.cos(theta) + 0.0065;
    const bdLat = z * Math.sin(theta) + 0.006;
    return [bdLat, bdLng];
}

/**
 * WGS-84 to BD-09
 */
export function wgs84ToBd09(lat: number, lng: number): [number, number] {
    const [gcjLat, gcjLng] = wgs84ToGcj02(lat, lng);
    return gcj02ToBd09(gcjLat, gcjLng);
}

export interface MapProvider {
    name: string;
    url: string;
    attribution: string;
    isChina: boolean;
    subdomains?: string[];
    tms?: boolean;
    crs?: string;
}

export const MAP_PROVIDERS: Record<string, MapProvider> = {
    OSM: {
        name: 'OpenStreetMap',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        subdomains: ['a', 'b', 'c'],
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        isChina: false
    },
    AMAP: {
        name: '高德地图 (Amap)',
        url: 'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
        subdomains: ['1', '2', '3', '4'],
        attribution: '&copy; <a href="https://www.amap.com/">Amap</a>',
        isChina: true
    },
    TENCENT: {
        name: '腾讯地图 (Tencent)',
        url: 'https://rt{s}.map.gtimg.com/tile?z={z}&x={x}&y={y}&styleid=1000&scene=0&version=347',
        subdomains: ['0', '1', '2', '3'],
        attribution: '&copy; <a href="https://map.qq.com/">Tencent Map</a>',
        isChina: true,
        tms: true
    },
    BAIDU: {
        name: '百度地图 (Baidu)',
        url: 'https://maponline{s}.bdimg.com/onlinelabel/?qt=tile&x={x}&y={y}&z={z}&styles=pl&scaler=1&p=1',
        subdomains: ['0', '1', '2', '3'],
        attribution: '&copy; <a href="https://map.baidu.com/">Baidu Map</a>',
        isChina: true,
        crs: 'Baidu'
    }
};

export type MapProviderKey = keyof typeof MAP_PROVIDERS;
