# Douyin Reference Collector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 为 Win7 Chrome 用户制作本地图文采集扩展，可累积参考笔记并导出含图片的 ZIP。

**Architecture:** 点击扩展后对当前笔记页面执行提取，以笔记 ID 保存到本地扩展存储。独立扩展管理页展示结果并获取图片、生成 ZIP，浏览器下载文件。

**Tech Stack:** Chrome Manifest V3 (Chrome 109+ / target 109), dependency-free JavaScript, Node built-in test runner.

**Spec:** docs/superpowers/specs/2026-10-27-douyin-collector-design.md

## Global Constraints
- Win7 Chrome109；最低Chrome109，不使用新版本限定API。
- 无服务器、无远程脚本，不读取Cookie或绕过验证。
- 用户点击后采集，只收集当前笔记；失败与不完整导出必须明确标识。

## Review Focus
- 笔记未加载或有验证页：拒绝并指导用户正常打开。
- 页面混有头像/推荐图：不可误收；找不到范围则提示。
- 图片延迟加载：同笔记重复采集去重并保留原顺序。
- 图片请求失败/类型异常：报告具体失败，不称完整导出。
- 中文和非法路径字符：ZIP UTF-8文件名安全、内容可解压。

### Task 1: 提取与扩展入口
**Files:** extension/manifest.json, extension/collector.js, extension/popup.html, extension/popup.js, dev/collector.test.mjs
**Interfaces:** extractNote(document, pageUrl) => {id,url,title,author,text,images:[url]} or explicit error.
- [x] 先编写并运行失败测试：实际包含推荐图和头像的离线页面、空页、验证页、两种延迟加载情况。
- [x] 实现Chrome109兼容的提取及activeTab/scripting调用，仅抖音笔记页允许采集。
- [x] 运行测试及脚本语法检查。

### Task 2: 累积与导出
**Files:** extension/library.html, extension/library.js, extension/zip.js, extension/store.js, tests/export.test.mjs
**Interfaces:** mergeNotes(existing,incoming); createZip(entries) => Uint8Array; exportNote(note) => entries plus download errors.
- [x] 先测试ID去重、同笔记图片顺序合并、命名安全、下载失败、超大资源拒绝和ZIP中文文件名。
- [x] 实现本地管理列表、删除、确认清空；浏览器扩展页请求图片并校验响应类型，生成ZIP后用chrome.downloads下载。
- [x] 用Python zipfile独立验证ZIP条目、CRC和内容；失败图片列入报告。

### Task 3: 交付和使用说明
**Files:** extension/README.md, downloads/douyin-reference-collector.zip
- [x] 运行完整测试，检查manifest所有路径及权限，离线浏览器检验管理页行为。
- [x] 创建无依赖安装ZIP，验证解压后manifest位于扩展根目录。
- [x] 中文说明包含Win7/Chrome109安装、采集、导出及错误处理，明确实际抖音页面尚待用户试用。
- [x] 检查GitHub远端后交付经授权的下载包，不覆盖既有素材。
