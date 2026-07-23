# DV 分屏特效生成器

纯前端网页工具：上传图片或视频，在浏览器本地生成 9:16 上下分屏、REC 取景框、暖色、颗粒、暗角和开场模糊效果，并通过 ffmpeg.wasm 导出苹果兼容的 H.264 MP4。

## 功能
- 一张素材自动复用为上下分屏，也可分别上传两张/两段
- 图片和视频均可
- 导出 PNG 封面
- 导出真正的 H.264 MP4（`yuv420p`、`faststart`，适合苹果设备）
- 显示录制、核心加载与转码进度
- 转码失败、内存不足和文件缺失提示
- 无后端、无上传、适合 GitHub Pages 或 IPv6 自托管

## MP4 导出原理

网页先用浏览器生成一个 6 秒临时视频，再交给随项目提供的单线程 `ffmpeg.wasm`，使用 `libx264` 编码为 H.264 MP4。最终只下载 `dv-split-effect.mp4`，不会把临时 WebM 下载给用户。

转码核心约 31 MB，第一次导出时加载，之后浏览器通常会缓存。使用单线程核心是为了兼容 GitHub Pages；多线程版本需要 GitHub Pages 无法自定义的 COOP/COEP 响应头。

## 本地运行
不要直接双击 HTML，建议启动静态服务器：

```bash
python3 -m http.server 8080
```

浏览器打开：`http://localhost:8080`

## GitHub Pages
1. 新建仓库并上传本目录全部文件，包括完整的 `vendor/ffmpeg/` 文件夹。
2. Settings → Pages。
3. Source 选择 `Deploy from a branch`。
4. Branch 选择 `main`，目录选择 `/ (root)`。

不要遗漏或重命名下面这些文件：

```text
vendor/ffmpeg/ffmpeg.js
vendor/ffmpeg/814.ffmpeg.js
vendor/ffmpeg/ffmpeg-core.js
vendor/ffmpeg/ffmpeg-core.wasm
```

## IPv6 自托管
在可被公网 IPv6 访问的电脑或服务器运行：

```bash
python3 -m http.server 8080 --bind ::
```

放行 IPv6 TCP 8080 后访问：

```text
http://[你的公网IPv6]:8080
```

公网使用建议再通过 Caddy/Nginx 配置 HTTPS。注意 IPv6 地址必须放在方括号内。

## 已知限制

- 浏览器端 H.264 编码计算量较大，手机导出会比电脑慢，旧设备可能因内存不足而失败。
- 导出期间需要保持页面在前台；锁屏或切到后台可能暂停录制或转码。
- 当前导出为 6 秒、720×1280、30 fps、无音频。
- Safari 的下载文件通常出现在“文件”App 的“下载项”，需要手动存入“照片”。
- 首次打开转码功能需读取约 31 MB 的 wasm；GitHub Pages 和浏览器缓存正常时，后续会更快。
