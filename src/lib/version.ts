/**
 * 版本号与更新记录 —— 数据在 `src/version.json`，**发版时只改那个文件**。
 *
 * 结构：`{ last, versions: [{ version, info: [...] }] }`
 * 首页底部显示 `last`；点开弹窗按新→旧列出 `versions`。
 */

import data from '../version.json'

export interface VersionEntry {
  version: string
  info: string[]
}

export interface Changelog {
  last: string
  versions: VersionEntry[]
}

export const changelog = data as Changelog

/** 当前版本号（首页底部展示） */
export const APP_VERSION = changelog.last
