# HTTPS 静态部署说明

摄像头 API 通常只在安全上下文可用：电脑本机 `localhost` 可以用于开发测试，手机访问时应使用 HTTPS 域名。局域网普通 HTTP 地址在多数手机浏览器中无法取得摄像头权限。

本文只说明部署方式，不执行部署。以下域名、路径和服务器信息都是占位符。

## 构建静态文件

```bash
npm install
npm run build
```

将生成的 `dist/` 目录作为静态站点根目录上传到你选择的静态托管平台，例如使用占位项目 `https://<your-domain.example>/`。确认平台提供 HTTPS，并保留 `manifest.webmanifest`、`sw.js` 和 `icons/`。

## 静态站点平台通用步骤

1. 在平台创建一个静态站点项目，不配置后端 API。
2. 构建命令设置为 `npm run build`，输出目录设置为 `dist`。
3. 绑定你自己的 HTTPS 域名或平台提供的 HTTPS 预览域名。
4. 在手机浏览器打开 HTTPS 地址，点击“打开摄像头”并授权。
5. 检查 service worker、manifest 和图标请求没有被平台的重写规则拦截。

## Caddy 示例

下面的配置假设你已经把静态文件放在占位目录 `/srv/placeholder/iv-drip-watch/dist`，并使用占位域名 `<your-domain.example>`。Caddy 会为正确解析到该服务器的域名申请 HTTPS 证书；请先按你的环境替换占位符和 DNS 配置。

```caddyfile
<your-domain.example> {
    root * /srv/placeholder/iv-drip-watch/dist
    encode gzip
    file_server
}
```

不需要反向代理到 Node 服务，Vite 开发服务器只用于本地开发。不要把摄像头流、视频文件或用户数据加入静态资源目录。

## 手机验收清单

- 地址栏显示 HTTPS 且证书有效。
- 首次打开后允许摄像头权限。
- 视频能显示，检测框可移动和改变大小。
- 开始监测后页面保持前台，检查 Wake Lock 是否可用。
- 点击测试报警确认声音和振动权限。
- 将页面添加到手机桌面后再重复一次摄像头授权与报警测试。
- 关闭网络后只能验证静态壳是否打开；不要把离线打开误认为摄像头一定可用。
