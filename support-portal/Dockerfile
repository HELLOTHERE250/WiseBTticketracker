FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Expose port
ENV PORT=3000
EXPOSE 3000

# Use a volume for the SQLite DB if run locally via docker
VOLUME ["/usr/src/app/data"]

# Start the server
CMD ["node", "server.js"]
