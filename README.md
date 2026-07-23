# DV 分屏特效生成器

纯前端网页工具：上传图片或视频，在浏览器本地生成 9:16 上下分屏、REC 取景框、暖色、颗粒、暗角和开场模糊效果。

## 功能
- 一张素材自动复用为上下分屏，也可分别上传两张/两段
- 图片和视频均可
- 导出 PNG 封面
- 导出 6 秒 MP4/WebM（取决于浏览器支持）
- 无后端、无上传、适合 GitHub Pages 或 IPv6 自托管

## 本地运行
不要直接双击 HTML，建议启动静态服务器：

```bash
python3 -m http.server 8080
```

浏览器打开：`http://localhost:8080`

## GitHub Pages
1. 新建仓库并上传本目录全部文件。
2. Settings → Pages。
3. Source 选择 `Deploy from a branch`。
4. Branch 选择 `main`，目录选择 `/ (root)`。

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
