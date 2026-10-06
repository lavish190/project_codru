# Use a lightweight Node.js environment
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your server code
COPY . .

# Expose the port your app runs on
EXPOSE 8080

# Start the application
CMD ["node", "app.js"]