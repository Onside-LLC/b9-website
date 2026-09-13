# B9 static site — nginx container for Kamal on onside-web.
#
# This is the reusable Foundation-tier static-site shape (onside-os#141):
# no build step, no runtime secrets, no application server. Everything the
# container does is serve files and answer /up.
#
# Build:  docker build -t b9-baseball .
# Run:    docker run --rm -p 8080:80 b9-baseball
FROM nginx:1.27-alpine

# Server config: gzip, cache headers, security headers, /up healthcheck.
COPY config/nginx.conf /etc/nginx/conf.d/default.conf

# Site content. Add new top-level files/directories here as the site grows.
COPY index.html /usr/share/nginx/html/index.html
COPY images/ /usr/share/nginx/html/images/

EXPOSE 80
