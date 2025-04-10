# Use official Node.js LTS image
FROM node:23.11-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package and install dependencies
COPY package*.json ./
RUN npm install

# Copy app files
COPY . .

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
