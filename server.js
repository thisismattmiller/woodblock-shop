/**
 * This is the main Node.js server script for your project
 * Check out the two endpoints this back-end API provides in fastify.get and fastify.post below
 */


const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const path = require("path");

// Require the fastify framework and instantiate it
const fastify = require("fastify")({
  // Set this to true for detailed logging:
  // logger: true,
  bodyLimit: 10485760
});

// ADD FAVORITES ARRAY VARIABLE FROM TODO HERE

// Setup our static files
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
  prefix: "/", // optional: default '/'
});
fastify.register(require('@fastify/multipart'))

// Formbody lets us parse incoming forms
fastify.register(require("@fastify/formbody"));

// View is a templating manager for fastify
fastify.register(require("@fastify/view"), {
  engine: {
    handlebars: require("handlebars"),
  },
});

// Load and parse SEO data
const seo = require("./src/seo.json");
if (seo.url === "glitch-default") {
  seo.url = `https://woodblockshop.thisismattmiller.com`;
}

/**
 * Our home page route
 *
 * Returns src/pages/index.hbs with data built into it
 */
fastify.get("/", function (request, reply) {
  // params is an object we'll pass to our handlebars template
  let params = { seo: seo };

  // If someone clicked the option for a random color it'll be passed in the querystring
  if (request.query.randomize) {
    // We need to load our color data file, pick one at random, and add it to the params
    const colors = require("./src/colors.json");
    const allColors = Object.keys(colors);
    let currentColor = allColors[(allColors.length * Math.random()) << 0];

    // Add the color properties to the params object
    params = {
      color: colors[currentColor],
      colorError: null,
      seo: seo,
    };
  }

  // The Handlebars code will be able to access the parameter values and build them into the page
  return reply.view("/src/pages/index.hbs", params);
});





fastify.post("/postimage", async function (request, reply) {
  
  console.log(request.headers.referer)
  console.log(request.headers.origin)
  console.log(request.headers.host)

  if (    
      request.headers.referer != 'https://woodblockshop.glitch.me/' && 
      request.headers.origin != 'https://woodblockshop.glitch.me' && 
      request.headers.host != 'woodblockshop.glitch.me' &&
      request.headers.host.indexOf('0.0.0.0') == -1 &&
      request.headers.host.indexOf('woodblockshop.thisismattmiller.com') == -1
     ){  
    reply
      .code(500)
      .header('Content-Type', 'application/json; charset=utf-8')
      .send({ results: 'Host name mismatch', code: 500 })

    return true
  }
  
  
  
  const s3 = new S3Client({
    region: process.env.WOODBLOCK_AWS_REGION,
    accessKeyId: process.env.WOODBLOCK_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.WOODBLOCK_AWS_SECRET_ACCESS_KEY
  });
  

  let uuid = uuidv4()
  
  let base64Image = request.body.data.split(';base64,').pop();  
  const buffer = Buffer.from(base64Image, "base64");
  
//   fs.writeFileSync(`/tmp/${uuid}/${uuid}.png`, base64Image, {encoding: 'base64'})
//   fs.writeFileSync(`/tmp/${uuid}/${uuid}.json`, JSON.stringify({
//     sources: request.body.sources,
//     title: request.body.title
//   }));

  

  
  const putObjectCommand = new PutObjectCommand({
    Bucket: process.env.WOODBLOCK_AWS_BUCKET, 
    Key: `uploaded/${uuid}/${uuid}.png`,
    Body: buffer,
    ContentType: 'image/png',
  });

  let r1 = await s3.send(putObjectCommand);
  
  const putObjectCommand2 = new PutObjectCommand({
    Bucket: process.env.WOODBLOCK_AWS_BUCKET, 
    Key: `uploaded/${uuid}/${uuid}.json`,
    Body: JSON.stringify({
      title: request.body.title,
      sources:request.body.sources
    }),
    ContentType: 'application/json',
  });

  let r2 = await s3.send(putObjectCommand2);
  
  let responseCode = 500
  let responseMsg = 'There was an error!'
  if (r1 && r1['$metadata'] && r1['$metadata'].httpStatusCode && r1['$metadata'].httpStatusCode == 200){
    
    responseCode = 200
    responseMsg ='Uploaded'
    
    
  }

  reply
    .code(responseCode)
    .header('Content-Type', 'application/json; charset=utf-8')
    .send({ results: responseMsg, code: responseCode })  
  
});



// Run the server and report out to the logs
fastify.listen(
  { port: process.env.PORT, host: "0.0.0.0" },
  function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
  }
);
