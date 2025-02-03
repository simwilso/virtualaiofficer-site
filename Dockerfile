# Use an official Node.js runtime as a parent image
FROM node:14

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./
COPY .env ./

# Install dependencies
RUN npm install

# Bundle app source code into the Docker image
COPY . .

# Expose port 3000 for the application
EXPOSE 3000

# Define the command to run the app
CMD [ "npm", "start" ]
