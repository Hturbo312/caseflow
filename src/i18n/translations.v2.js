// 双语改造新增词条（成对定义，自动拆为 v2zh / v2en 并覆盖同名旧 key）
import { pairs as a } from './dicts/a';
import { pairs as b } from './dicts/b';
import { pairs as c } from './dicts/c';
import { pairs as d } from './dicts/d';
import { pairs as e } from './dicts/e';
import { pairs as sys } from './dicts/sys';
import { pairs as ux } from './dicts/ux';

const M = { ...a, ...b, ...c, ...d, ...e, ...sys, ...ux };

export const v2zh = Object.fromEntries(Object.entries(M).map(([k, v]) => [k, v[0]]));
export const v2en = Object.fromEntries(Object.entries(M).map(([k, v]) => [k, v[1]]));
