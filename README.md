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

4. **Start Redis::**
   <br />  Open a new terminal and run the following command:
   ```bash
   redis-stack-server
   ```

5. **Run the Application:**
   If you have nodemon installed, run the following command:
   ```bash
   npx nodemon index.js
   ```

   Otherwise, run the following command:
   ```bash
   node index.js
   ```
