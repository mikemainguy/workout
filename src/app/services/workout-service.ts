import { Injectable } from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class WorkoutService {
  apiUrl = 'https://workout.restlet.net/v2/categories/';

  /*");\n' +
      '\n' +
      'req.headers({\n' +
      '  "authorization": "Basic MWYyZGU0MWEtOGJjNC00NTUyLTliYmItMjNjMWFmMmY2MWNiOjJlNDVmNDM2LTk3ZDEtNDU2YS04OGE5LTRjYmFlMDk2ZWQ4Mw==",\n' +
      '  "content-type": "application/json",\n' +
      '  "accept": "application/json",\n' +
      '  "host": "workout.restlet.net"\n' +
      '});\n' +
      '\n' +
      '\n' +
      'req.end(function (res) {\n' +
      '  if (res.error) throw new Error(res.error);\n' +
      '\n' +
      '  console.log(res.body);\n' +
      '});';
      */
  headers: HttpHeaders = new HttpHeaders()
      .append('authorization',
          'Basic MWYyZGU0MWEtOGJjNC00NTUyLTliYmItMjNjMWFmMmY2MWNiOjllNWVhNDVkLThmOTUtNDJkNi05ZDNkLTEyN2YzNmQyOTU3NA==');
  constructor(public http: HttpClient) { }

  getCategories() {
    return new Promise((resolve, reject) => {
      this.http.get(this.apiUrl, {headers: this.headers}).subscribe(data => {
        resolve(data);
      }, err => {
        console.log(err);
      });
    });
  }
}
