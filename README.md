# Woolworths Innovation Investment Committee

扫码课堂互动应用。学生进入投票页，老师打开 dashboard 观看实时汇总和课堂倾向分析。

## 本地预览

```powershell
cd woolworths-innovation-activity
npm start
```

Open:

- Student page: `http://localhost:3128`
- Teacher dashboard: `http://localhost:3128/admin`

## 放进 PPT 的二维码

PPT 里的二维码必须指向公网 URL，例如：

```text
https://your-app-name.onrender.com/
```

不要使用 `localhost` 或 `192.168.x.x` 生成 PPT 二维码，因为同学的手机无法从互联网访问这些本机地址。

部署完成后打开：

```text
https://your-app-name.onrender.com/qr.svg
```

这个 SVG 图片就是可以放进 PPT 的二维码。也可以打开教师端：

```text
https://your-app-name.onrender.com/admin
```

教师端左侧会显示二维码和 `Open PPT QR code` 链接。

## 推荐部署方式：Render

1. 把 `woolworths-innovation-activity` 文件夹上传到 GitHub 仓库。
2. 在 Render 新建 `Web Service`，连接这个仓库。
3. 设置：
   - Build command: `npm install`
   - Start command: `npm start`
   - Environment: `Node`
4. 添加环境变量：
   - `ADMIN_KEY`: 自己设置一个教师密码，例如 `week5-woolworths`
   - `PUBLIC_URL`: Render 分配给你的公网地址，例如 `https://your-app-name.onrender.com`
5. 部署完成后，用 `PUBLIC_URL` 生成二维码并放进 PPT。

如果第一次创建服务时还不知道 Render 地址，可以先不填 `PUBLIC_URL`。部署成功后复制 Render 给你的 URL，再进入 Render 的 `Environment` 页面补上 `PUBLIC_URL`，保存后重新部署。

## 上课使用

- 学生扫码进入：`PUBLIC_URL`
- 老师打开：`PUBLIC_URL/admin`
- Dashboard 会显示：
  - 实时投票人数
  - 四个方案的总票数
  - 每一轮的选择分布
  - 根据最高票方案生成的课堂倾向分析

教师端的 `Reset` 和 `Export CSV` 会要求 `ADMIN_KEY`，适合公网课堂使用。
