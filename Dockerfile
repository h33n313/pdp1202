# مرحله ۱: بیلد کردن اپلیکیشن
FROM node:20-slim AS builder

WORKDIR /app

# کپی فایلهای پکیج و نصب وابستگیها
COPY package*.json ./
RUN npm install

# کپی تمامی فایلهای سورس و اجرای بیلد
COPY . .
RUN npm run build

# مرحله ۲: ایجاد تصویر نهایی و سبک‌وزن برای اجرا
FROM node:20-slim

WORKDIR /app

# تنظیم متغیر محیطی برای حالت Production
ENV NODE_ENV=production

# کپی کردن خروجی بیلد شده (فرانت‌اِند)
COPY --from=builder /app/dist ./dist
# کپی کردن فایلهای مورد نیاز برای بک‌اِند
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.js ./

# نصب فقط وابستگیهای ضروری برای اجرا (Production)
RUN npm install --omit=dev

# ایجاد پوشه دیتا برای ذخیره دیتابیس (بسیار مهم برای Persistence)
RUN mkdir -p /app/data

# تنظیم پورت (مطابق با تنظیمات ایزی‌پنل)
EXPOSE 4000

# دستور اجرای سرور
CMD ["node", "server.js"]
