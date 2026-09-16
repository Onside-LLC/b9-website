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

# Site content: the whole build context, minus whatever .dockerignore drops.
#
# Deliberately NOT an enumerated list of top-level files. The previous version
# copied only index.html and images/, which silently 404s every page, the
# stylesheet and the script the moment the site grows past one page — exactly
# what happened when the concept B build added css/, js/ and five directories
# of pages. The exclusion list is the thing to maintain; adding a page is not
# supposed to require a Dockerfile edit.
COPY . /usr/share/nginx/html/

# config/ is in the build context only so the COPY above it can reach
# nginx.conf. It is not site content and must not be served.
RUN rm -rf /usr/share/nginx/html/config

EXPOSE 80
