# CM Drozdi web page

This project is the source code of www.cmdrozdi.cz

## How to run local dev

### Prerequisites

1. NodeJs LTS version

### How to start dev

1. Create PrismaDB on your local machine - You can use DBngin or any other solution you find attractive
2. Create .env file. You will need following keys to run the application:
    1. DATABASE_URL in following format <i>"postgres://{userName}:{password}@{ipAddress}:{port}"</i>
    2. <b>TODO</b> make other keys not required for dev env
    3. <b>TODO</b> Create mock authentication
3. Make sure your db is running
4. From root folder of this project run `npm run db:push`
5. You are now ready to start dev env with `npm run dev`
6. Happy coding

