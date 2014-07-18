/**
 * ownCloud - Calendar App
 *
 * @author Raghu Nayyar
 * @author Georg Ehrke
 * @copyright 2014 Raghu Nayyar <beingminimal@gmail.com>
 * @copyright 2014 Georg Ehrke <oc.list@georgehrke.com>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU AFFERO GENERAL PUBLIC LICENSE for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this library.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

app.controller('CalController', ['$scope', '$modal', 'Restangular', 'calendar', 'CalendarModel', 'EventsModel', 'ViewModel', 'TimezoneModel',
	function ($scope, $modal, Restangular, calendar, CalendarModel, EventsModel, ViewModel, TimezoneModel) {
		$scope.eventSources = EventsModel.getAll();
		$scope.defaultView = ViewModel.getAll();
		$scope.calendarmodel = CalendarModel;
		$scope.defaulttimezone = TimezoneModel.currenttimezone();
		$scope.eventsmodel = EventsModel;
		$scope.i = 0;
		var switcher = [];
		var viewResource = Restangular.one('view');

		if ($scope.defaulttimezone.length > 0) {
			$scope.requestedtimezone = $scope.defaulttimezone.replace('/', '-');
			Restangular.one('timezones', $scope.requestedtimezone).get().then(function (timezonedata) {
				$scope.timezone = TimezoneModel.addtimezone(timezonedata);
			}, function (response) {
				OC.Notification.show(t('calendar', response.data.message));
			});
		}

		// Responds to change in View from calendarlistcontroller.
		viewResource.get().then(function (views) {
			ViewModel.add(views);
		});
		//$scope.defaultView = viewResource.get();

		$scope.eventSource = {};
		$scope.calendars = $scope.calendarmodel.getAll();

		$scope.addRemoveEventSources = function (newid, calendar) {
			$scope.i++;
			if (switcher.indexOf(newid) > -1) {
				switcher.splice(switcher.indexOf(newid), 1);
				Restangular.one('calendars', newid).patch({'enabled': false}).then(function (blah) {
					CalendarModel.toggleactive(newid,blah.enabled);
				});
				calendar.fullCalendar('removeEventSource', $scope.eventSource[newid]);
			} else {
				switcher.push(newid);
				Restangular.one('calendars', newid).patch({'enabled': true}).then(function (blah) {
					CalendarModel.toggleactive(newid,blah.enabled);
				});
				calendar.fullCalendar('addEventSource', $scope.eventSource[newid]);
			}
		};

		var initEventSources = [];
		angular.forEach($scope.calendars, function (value, key) {
			if ($scope.eventSource[value.id] === undefined) {
				$scope.eventSource[value.id] = {
					events: function (start, end, timezone, callback) {
						start = start.format('X');
						end = end.format('X');
						Restangular.one('calendars', value.id).one('events').one('inPeriod').getList(start + '/' + end).then(function (eventsobject) {
							callback(EventsModel.addAllDisplayFigures(value.id, eventsobject, start, end, $scope.timezone));
						}, function (response) {
							OC.Notification.show(t('calendar', response.data.message));
						});
					},
					color: value.color,
					editable: value.cruds.update,
					id: value.id
				};
				if (value.enabled === true && value.components.vevent === true) {
					initEventSources.push($scope.eventSource[value.id]);
					switcher.push(value.id);
					angular.element('#calendarlist li a[data-id=' + value.id + ']').parent().addClass('active');
				}
			}
		});

		$scope.uiConfig = {
			calendar: {
				height: $(window).height() - $('#controls').height() - $('#header').height(),
				editable: true,
				selectable: true,
				selectHelper: true,
				select: $scope.newEvent,
				eventSources: initEventSources,
				timezone: $scope.defaulttimezone,
				defaultView: $scope.defaultView,
				//eventColor: $scope.currentcalendar.color,
				header: {
					left: '',
					center: '',
					right: ''
				},
				columnFormat: {
					month: t('calendar', 'ddd'),
					week: t('calendar', 'ddd M/D'),
					day: t('calendar', 'dddd M/D')
				},
				titleFormat: {
					month: t('calendar', 'MMMM yyyy'),
					week: t('calendar', "MMM d[ yyyy]{ '–'[ MMM] d yyyy}"),
					day: t('calendar', 'dddd, MMM d, yyyy')
				},
				eventClick: function( event, jsEvent, view ) {
					EventsModel.putmodalproperties(event,jsEvent,view);
				},
				eventResize: function (event, delta, revertFunc) {
					Restangular.one('calendars', event.calendarId).one('events', event.objectUri).get().then(function (eventsobject) {
						var data = EventsModel.eventResizer(event, delta, eventsobject);
						if (data === null) {
							revertFunc();
						}
					}, function (response) {
						OC.Notification.show(t('calendar', response.data.message));
					});
				},
				eventDrop: function (event, delta, revertFunc) {
					Restangular.one('calendars', event.calendarId).one('events', event.objectUri).get().then(function (eventsobject) {
						var data = EventsModel.eventDropper(event, delta, eventsobject);
						if (data === null) {
							revertFunc();
						}
					}, function (response) {
						OC.Notification.show(t('calendar', response.data.message));
					});
				},
				viewRender: function (view) {
					angular.element('#datecontrol_current').html($('<p>').html(view.title).text());
					angular.element("#datecontrol_date").datepicker("setDate", $scope.calendar.fullCalendar('getDate'));
					var newview = view.name;
					if (newview != $scope.defaultView) {
						viewResource.get().then(function (newview) {
							ViewModel.add(newview);
						}, function (response) {
							OC.Notification.show(t('calendar', response.data.message));
						});
						$scope.defaultView = newview;
					}
					if (newview === 'agendaDay') {
						angular.element('td.fc-state-highlight').css('background-color', '#ffffff');
					} else {
						angular.element('td.fc-state-highlight').css('background-color', '#ffc');
					}
					if (newview == 'agendaWeek') {
						$scope.calendar.fullCalendar('option', 'aspectRatio', 0.1);
					} else {
						$scope.calendar.fullCalendar('option', 'aspectRatio', 1.35);
					}
				}
			}
		};

		$scope.$watch('eventsmodel.calid', function (newid, oldid) {
			newid = newid.id;
			if (newid !== '') {
				$scope.addRemoveEventSources(newid, $scope.calendar);
			}
		}, true);

		$scope.$watch('calendarmodel.activator', function (newobj, oldobj) {
			if (newobj.id !== '') {
				if (newobj.bool === true) {
					angular.element('#calendarlist li a[data-id=' + newobj.id + ']').parent().addClass('active');
				} else {
					angular.element('#calendarlist li a[data-id=' + newobj.id + ']').parent().removeClass('active');
				}
			}
		}, true);

		$scope.$watch('calendarmodel.modelview', function (newview, oldview) {
			$scope.changeView = function (newview, calendar) {
				calendar.fullCalendar('changeView', newview);
			};
			$scope.today = function (calendar) {
				calendar.fullCalendar('today');
			};
			if (newview.view && $scope.calendar) {
				if (newview.view != 'today') {
					$scope.changeView(newview.view, $scope.calendar);
				} else {
					$scope.today($scope.calendar);
				}
			}
		}, true);

		$scope.$watch('calendarmodel.datepickerview', function (newview, oldview) {
			$scope.changeview = function (newview, calendar) {
				calendar.fullCalendar(newview.view);
			};
			if (newview.view !== '' && $scope.calendar !== undefined) {
				$scope.changeview(newview, $scope.calendar);
			}
		}, true);

		$scope.$watch('calendarmodel.date', function (newview, oldview) {
			$scope.gotodate = function (newview, calendar) {
				calendar.fullCalendar('gotoDate', newview);
			};
			if (newview !== '' && $scope.calendar !== undefined) {
				$scope.gotodate(newview, $scope.calendar);
			}
		});

		$scope.$watch('calendarmodel.firstday', function (newview, oldview) {
			$scope.firstdayview = function (newview,calendar) {
				calendar.fullCalendar('firstDay', newview);
			};
			if (newview !== '' && $scope.calendar !== undefined) {
				$scope.firstdayview(newview, $scope.calendar);
			}
		});
	}
]);
