import { Events, Notice } from "obsidian";
import type FantasyCalendar from "src/main";
import { dateString } from "src/utils/functions";
import type { Calendar, CurrentCalendarData, Month, Event } from "../@types";

export class MonthHelper {
    days: DayHelper[] = [];
    get name() {
        return this.data.name;
    }

    get daysBefore() {
        return this.calendar.daysBeforeMonth(this);
    }

    get firstWeekday() {
        if (!this.calendar.data.overflow) return 0;
        return this.days[0].weekday;
    }
    get lastWeekday() {
        return this.days[this.days.length - 1].weekday;
    }

    get type() {
        return this.data.type;
    }

    constructor(
        public data: Month,
        public number: number,
        public calendar: CalendarHelper
    ) {
        this.days = [...new Array(data.length).keys()].map(
            (k) => new DayHelper(this, k + 1)
        );
    }
}

export class DayHelper {
    get calendar() {
        return this.month.calendar;
    }
    get date() {
        return {
            day: this.number,
            month: this.month.number,
            year: this.calendar.displayed.year
        };
    }
    get events(): Event[] {
        return this.calendar.getEventsOnDate(this.date);
    }
    get longDate() {
        return {
            day: this.number,
            month: this.month.name,
            year: this.calendar.displayed.year
        };
    }
    get weekday() {
        const days = this.month.daysBefore + this.number - 1;

        const firstOfYear = this.calendar.firstDayOfYear();

        return wrap(
            (days % this.calendar.weekdays.length) + firstOfYear,
            this.calendar.weekdays.length
        );
    }
    get isCurrentDay() {
        return (
            this.number == this.calendar.current.day &&
            this.calendar.displayed.month == this.calendar.current.month &&
            this.calendar.displayed.year == this.calendar.current.year
        );
    }
    get isDisplaying() {
        return (
            this.number == this.calendar.viewing.day &&
            this.calendar.displayed.year == this.calendar.viewing.year &&
            this.calendar.displayed.month == this.calendar.viewing.month
        );
    }
    constructor(public month: MonthHelper, public number: number) {}
}

export default class CalendarHelper extends Events {
    months: MonthHelper[];
    constructor(public object: Calendar, public plugin: FantasyCalendar) {
        super();

        this.months = this.data.months.map(
            (m, i) => new MonthHelper(m, i, this)
        );
        this.displayed = { ...this.current };
    }
    get data() {
        return this.object.static;
    }
    get current() {
        return this.object.current;
    }
    displayed: CurrentCalendarData = {
        year: null,
        month: null,
        day: null
    };

    viewing: CurrentCalendarData = {
        year: null,
        month: null,
        day: null
    };

    getEventsOnDate(date: CurrentCalendarData) {
        return this.object.events.filter((e) => {
            return (
                e.date.day == date.day &&
                (e.date.month == undefined || e.date.month == date.month) &&
                (e.date.year == undefined || e.date.year == date.year)
            );
        });
    }

    get currentDate() {
        return dateString(
            this.current,
            this.months.map((m) => m.data)
        );
    }

    get displayedDate() {
        return dateString(
            this.displayed,
            this.months.map((m) => m.data)
        );
    }
    get viewedDate() {
        return dateString(
            this.viewing,
            this.months.map((m) => m.data)
        );
    }

    reset() {
        this.displayed = { ...this.current };

        this.trigger("month-update");
        this.trigger("day-update");
    }

    setCurrentMonth(n: number) {
        this.displayed.month = n;

        this.trigger("month-update");
        this.trigger("day-update");
    }

    goToNextDay() {
        this.viewing.day += 1;
        const currentMonth = this.months[this.displayed.month];
        if (this.viewing.day > currentMonth.days.length) {
            this.goToNext();
            this.viewing.month = this.displayed.month;
            this.viewing.year = this.displayed.year;
            this.viewing.day = 1;
        }
        this.trigger("day-update");
    }
    goToPreviousDay() {
        this.viewing.day -= 1;
        if (this.viewing.day < 1) {
            this.goToPrevious();
            this.viewing.month = this.displayed.month;
            this.viewing.year = this.displayed.year;
            this.viewing.day = this.currentMonth.days.length;
        }
        this.trigger("day-update");
    }

    get nextMonthIndex() {
        return wrap(this.displayed.month + 1, this.months.length);
    }
    get nextMonth() {
        return this.months[this.nextMonthIndex];
    }
    goToNext() {
        if (this.nextMonthIndex < this.displayed.month) {
            this.displayed.year += 1;
        }
        this.setCurrentMonth(this.nextMonthIndex);
    }
    get prevMonthIndex() {
        return wrap(this.displayed.month - 1, this.months.length);
    }
    get previousMonth() {
        return this.months[this.prevMonthIndex];
    }
    goToPrevious() {
        if (this.prevMonthIndex > this.displayed.month) {
            if (this.displayed.year == 1) {
                new Notice("This is the earliest year.");
                return;
            }
            this.displayed.year -= 1;
        }
        this.setCurrentMonth(this.prevMonthIndex);
    }

    get weekdays() {
        return this.data.weekdays;
    }
    get currentMonth() {
        return this.months[this.displayed.month];
    }
    get daysOfCurrentMonth() {
        return this.currentMonth.days;
    }
    get paddedDays() {
        let previous: DayHelper[] = [];
        let current = this.daysOfCurrentMonth;
        let next: DayHelper[] = [];

        /** Get Days of Previous Month */
        if (this.currentMonth.firstWeekday > 0) {
            previous = this.previousMonth.days.slice(
                -this.currentMonth.firstWeekday
            );
        }

        /** Get Days of Next Month */
        if (
            this.currentMonth.lastWeekday < this.weekdays.length - 1 &&
            this.currentMonth.type == "month"
        ) {
            next = this.nextMonth.days.slice(
                0,
                this.weekdays.length - this.currentMonth.lastWeekday - 1
            );
        }

        return {
            previous,
            current,
            next
        };
    }

    /**
     *
     * Returns the rounded up number of weeks of the current month. Use to build calendar rows.
     * @readonly
     * @memberof Calendar
     */
    get weeksPerCurrentMonth() {
        return Math.ceil(
            this.data.months[this.displayed.month].length /
                this.data.weekdays.length
        );
    }

    /**
     * Total number of days in a year.
     *
     * @readonly
     * @memberof Calendar
     */
    get daysPerYear() {
        return this.months
            .filter((m) => m.type === "month")
            .reduce((a, b) => a + b.days.length, 0);
    }
    daysBeforeMonth(month: MonthHelper) {
        if (this.months.indexOf(month) == 0) {
            return 0;
        }
        return this.months
            .filter((m) => m.type == "month")
            .slice(0, month.number)
            .reduce((a, b) => a + b.days.length, 0);
    }

    get firstWeekday() {
        return this.data.firstWeekDay;
    }
    firstDayOfYear() {
        if (this.displayed.year == 1) return this.firstWeekday;

        return wrap(
            ((Math.abs(this.displayed.year - 1) * this.daysPerYear) %
                this.data.weekdays.length) +
                this.firstWeekday,
            this.data.weekdays.length
        );
    }
}

export function wrap(value: number, size: number): number {
    return ((value % size) + size) % size;
}
