import { Component } from '@angular/core';
import {WorkoutService} from '../services/workout-service';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss']
})
export class Tab2Page {
  categories: any;
  constructor(public workoutService: WorkoutService) {
    this.getCategories();
  }

  getCategories() {
    this.workoutService.getCategories().then(data => {
      this.categories = data;
      console.log(this.categories);
    });
  }
}
