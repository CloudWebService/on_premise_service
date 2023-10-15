const express = require('express');
const Papa = require('papaparse');
const AWS = require("aws-sdk");
const dotenv = require("dotenv");
const csv = require("csv-parser");
csv.toString("utf-8");
dotenv.config();
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});
const bucketName = "onpremise127";
const foodKey = "folder/food.csv";
const cultureEventKey = "folder/culture_event.csv";
const curtureEventParams = {
  Bucket: bucketName,
  Key: cultureEventKey,
};
const foodParams = {
    Bucket: bucketName,
    Key: foodKey,
};

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
}

function findRestaurants(lat, lon, response) {
    s3.getObject(foodParams, (err, data) => {
        if (err) {
            throw err;
        }
        console.log("complete download!");

        // parsing csv
        var result = [{idx : -1, distance : Infinity}];
        const parsedData = Papa.parse(data.Body.toString('utf-8'), { header: true });
        parsedData.data.forEach((row, i) => {
            var distance = calculateDistance(row['위도'], row['경도'], lat, lon);
            var tmp = {idx : i, distance : distance};
            result.push(tmp);
            if(result.length > 5) {
                result.sort((a, b) => a.distance - b.distance);
                result.pop();
            }
        });
        
        var restaurants = [];
        for(var i = 0; i < result.length; i++) {
            restaurants.push(parsedData.data[result[i].idx]);
        }
        // -----------------------------------------------

        response.writeHead(200, {'Content-Type':'application/json'});
        response.end(JSON.stringify(restaurants));
    });
}

const app = express();
const port = 8080;

app.get('/api/restaurants', (req, res) => {
    const lat = req.query.lat;
    const lon = req.query.lon;
    findRestaurants(lat, lon, res);
});

app.get("/api/cultural-events", (req, res) => {
    //요청 파라미터 (district,category,start_date,end_date)
    const districtParam = req.query.district;
    const categoryParam = req.query.category;
    let startDateParam = req.query.start_date;
    let endDateParam = req.query.end_date;
    if (
      typeof startDateParam != "undefined" &&
      typeof endDateParam != "undefined"
    ) {
      startDateParam = new Date(req.query.start_date);
      endDateParam = new Date(req.query.end_date);
    }
    const filteredEvents = [];
  
    s3.getObject(curtureEventParams)
      .createReadStream()
      .pipe(csv())
      .on("data", (row) => {
        const category = row.category;
        const district = row.district;
        const start_date = new Date(row.start_date);
        const end_date = new Date(row.end_date);
  
        //param 전부 없는 경우, row가 filteredEvents에 등록되어야하므로 true여야됨
        const isAllEmpty =
          typeof districtParam === "undefined" &&
          typeof categoryParam === "undefined" &&
          typeof startDateParam === "undefined" &&
          typeof endDateParam === "undefined";
  
        let matches;
  
        //parameter로 시간정보 들어오면 차이 계산
        //현재 시간은 ISO 8601형식의 날짜와 시간을 나타냄. 요청 보낼때 한국시를 협정 세계시(UTC)로 보내기
        if (
          typeof startDateParam != "undefined" &&
          typeof endDateParam != "undefined"
        ) {
          const isYearMonthMatch =
            start_date >= startDateParam && end_date <= endDateParam;
          matches =
            (districtParam === undefined ? true : district === districtParam) &&
            (categoryParam === undefined ? true : category === categoryParam) &&
            isYearMonthMatch;
        } else {
          matches =
            (districtParam === undefined ? true : district === districtParam) &&
            (categoryParam === undefined ? true : category === categoryParam);
        }
        if (isAllEmpty || matches) {
          // console.log(start_date);
          filteredEvents.push(row);
        }
      })
      .on("end", () => {
        res.json(filteredEvents);
      })
      .on("error", (error) => {
        res.status(500).json({ error: "데이터 검색 중 오류가 발생했습니다." });
      });
  });

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});