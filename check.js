var AWS = require("aws-sdk");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const bucketName = "onpremise127"; // S3 버킷 이름으로 대체
const key = "folder/testimg";
const params = {
  Bucket: bucketName,
  Key: key,
  Body: fs.readFileSync("testimg.png"),
  ContentType: "image/png",
};
const localFilePath = "downtestimg.png"; // 로컬에 저장할 파일 경로

// s3.upload(params, function (err, data) {
//   if (err) {
//     throw err;
//   }
//   console.log("file uploaded succesffuly", data);
// });
const downparams = {
  Bucket: bucketName,
  Key: key,
};

s3.getObject(downparams, (err, data) => {
  if (err) {
    throw err;
  }
  fs.writeFileSync(
    `test-download.${data.ContentType.split("/")[1]}`,
    data.Body
  );
  //   fs.writeFileSync(localFilePath, data.Body);
  console.log("파일 다운로드 완료:", data);
});
