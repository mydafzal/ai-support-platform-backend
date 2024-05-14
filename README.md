# Customer Bot Backend

Welcome to the Customer Bot backend repository! This Node.js project serves as the backend for the Customer Bot, an AI application designed to assist various businesses in customizing and utilizing AI to service their customers.

## Pre-requisites

Before you can run the project locally, ensure you have the following installed on your local machine:

- [Chroma DB](https://docs.trychroma.com/getting-started?lang=js)
- [Redis](https://redis.io/docs/install/install-stack/)
- [PostgreSQL](https://www.postgresql.org/download/)

If any of the above is not installed on your local machine, visit the respective links and following the setup instructions in the documentation.

## Getting Started

Follow these steps to set up and run the Customer Bot backend on your local machine:

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/ccriptdev9/customer-bot-backend.git
   cd customer-bot-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start Chroma DB:**
   <br /> Open a new terminal and run the following command:
   ```bash
   chroma run
   ```

4. **Start Redis:**
   <br />  Open a new terminal and run the following command:
   ```bash
   redis-stack-server
   ```
4. **Initialize Database:**
    <br /> First, go to config/config.json file and note the credentials under "development". Create a PostgreSQL database named "customer-bot". You can also create a PostgresSQL database with a different name but then you'll need to replace it under "development" in the config/config.json file.
 
   <br /> After you have created your PostgreSQL database, run the following commands in the terminal within the project's root directory:

   <br />  Run the following to generate database models in the database:
   ```bash
   npx sequelize-cli db:migrate
   ```
   <br />  Run the following to execute the seeders:
   ```bash
   npx sequelize-cli db:seed:all
   ```

6. **Run the Application:**
    <br /> To start the server, run the following command:
   ```bash
   npm run start:dev
   ```

   <br /> If an occurs while running the command, it's probably due to the reason that you don't have nodemon installed on your machine. Run the following command to install nodemon globally:
   ```bash
   npm i -g nodemon
   ```
