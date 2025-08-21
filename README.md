# Vohala Social (MERN Starter)

A branded, minimal social network with:
- Auth (register/login with JWT)
- Create text/image posts
- Feed (self + following)
- Like & comment
- Follow / unfollow users

## Quickstart

### 1) Server
```
cd server
cp .env.example .env
# edit MONGO_URI and JWT_SECRET if you want
npm install
npm run dev
```
API: http://localhost:5000

### 2) Client
```
cd client
cp .env.example .env
npm install
npm run dev
```
Web: http://localhost:5173

### Notes
- Uploaded images are saved under `server/public/uploads/` and served at `/uploads/...`.
- For production, use HTTPS, a cloud object store for images (e.g., S3/Cloudinary), and a reverse proxy (Nginx).
