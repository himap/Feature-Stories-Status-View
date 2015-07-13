Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
	layout: {
		type: 'vbox',
		align: 'stretch'
	},
	margin: '5 5 5 5',
	items: [{
			xtype: 'container',
			layout: {
				type: 'hbox',
				align: 'stretch'
			},
			height: 290,
			items: [{
				xtype: 'container',
				id: 'formCnt',
				layout: {
					type: 'vbox'
				},
				items: [{
					xtype: 'text',
					text: 'Filter chart and grid by Target Release',
					margin: '0 0 5 0',
					width: 200
				}]
			}, {
				xtype: 'container',
				id: 'piechartCnt',
				layout: {
					type: 'vbox',
					align: 'stretch'
				},
			//	flex: 1,
				width: 500,
				margin: '0 70 0 70'
			}, {
				xtype: 'container',
				id: 'chartCnt',
				layout: {
					type: 'vbox',
					align: 'stretch'
				},
			//	flex: 1,
				width: 650,
				margin: '0 100 0 50'
			}]
		}, {
			xtype: 'container',
			flex: 1,
			layout: {
				type: 'hbox',
				align: 'stretch'
			},
			margin: '30 0 0 0',
			id: 'gridCnt'
	}],
	sagaFeatures: null,
	
	launch: function() {
		this._createFilterBox('c_TargetRelease');
		this._createFilterBox('ScheduleState');
		this.down('#formCnt').add({
			xtype: 'rallybutton',
			text: 'Submit',
			handler: function() {
				this._getFilter();
			},
			scope: this
		});
		this._createGrid(null);
	},	
	_getAllChildren: function() {
		this.childrenLoaded = 0;
		this.childrenToLoad = 0;
		var filterString = Ext.getCmp('ScheduleStateCombobox').getValue() + '';
		var filters = filterString.split(',');		
		_.forEach(this.sagaFeatures, function(sagaFeature) {
			if (_.contains(filters, sagaFeature.get('ScheduleState'))) {	
				this._getAllChildThings(sagaFeature, sagaFeature);
			}
		}, this);
		var me = this;
		var timeout = setInterval(function() {
			console.log('on', me.childrenLoaded, me.childrenToLoad);
			if (me.childrenLoaded >= me.childrenToLoad) {
				clearTimeout(timeout);
				me._onDataLoaded();
			}
		}, 300);
	},
	_getAllChildThings: function(sagaFeature, child) {
		if (child.get('DirectChildrenCount') > 0) {
			this.childrenToLoad++;
			var children = child.getCollection('Children', {fetch: ['FormattedID', 'Name', '_ref', 'ObjectID', 'Parent', '_ItemHierarchy', 'Iteration', 'Release', 'Project', 'ScheduleState', 'PlanEstimate']});
			children.load({callback: function(data) {
				this.childrenLoaded++;
				_.forEach(data, function(c) {
					if (c.get('DirectChildrenCount') === 0) {
						sagaFeature.children.push(c);
					}
					this._getAllChildThings(sagaFeature, c);
				}, this);
			}, scope: this});
		}
		this.childrenToLoad++;
		var testCases = child.getCollection('TestCases', {fetch: ['FormattedID', 'LastVerdict']});
		testCases.load({callback: function(data) {
			_.forEach(data, function(tc) {
				sagaFeature.testCases.push(tc);
			}, this);
			this.childrenLoaded++;
		}, scope: this});
		
	},
	
	_createFilterBox: function(property) {
		if (property === "c_TargetRelease") {
			this.down('#formCnt').add({
				xtype: 'rallyfieldvaluecombobox',
				id: property + 'Combobox',
				model: 'UserStory',
				multiSelect: true,
				field: property,
				onReady: function() {
					var items = this.getStore().getRange();
					var item;
					_.forEach(items, function(i) {
						if (i.get('name') === '17.0') {
							item =i;
							return false;
						}
					});
					this.select(item);
				}
			});
		}
		else {
			this.down('#formCnt').add([{
					xtype: 'text',
					text: 'Filter grid by Schedule State',
					margin: '0 0 5 0',
					width: 200
				},{
				xtype: 'rallyfieldvaluecombobox',
				id: property + 'Combobox',
				model: 'UserStory',
				multiSelect: true,
				field: property,
				onReady: function() {
					var items = this.getStore().getRange();
					var item;
					_.forEach(items, function(i) {
						if (i.get('name') === 'Completed') {
							item =i;
							return false;
						}
					});
					this.select(item);
				}
			}]);
		}
	},

	_getFilter: function() {
		if (this.down('#rollupPieChart')) {
			this.down('#rollupPieChart').destroy();  
		}
		if (this.down('#rollupChart')) {
			this.down('#rollupChart').destroy();  
		}
		this.grid.reconfigure(null);
		this.grid.setLoading(true);
		var filter = Ext.create('Rally.data.wsapi.Filter',{property: 'c_StoryType', operator: '=', value: 'SAGA Feature'});
		filter=this._checkFilterStatus('c_TargetRelease',filter);					
		if (this._myStore === undefined) {
			this._makeStore(filter);
		}
		else {
			this._myStore.clearFilter(true);
			this._myStore.filter(filter);

		}
	},
	
	_checkFilterStatus: function(property, filter) {
		
			var filterString=Ext.getCmp(property + 'Combobox').getValue() +'';
			var filterArr=filterString.split(',');
			var propertyFilter=Ext.create('Rally.data.wsapi.Filter',{property: property, operator: '=', value: filterArr[0]});
			var i=1;
			while (i < filterArr.length){
				propertyFilter=propertyFilter.or({
					property: property,
				operator: '=',
				value: filterArr[i]
			});
			i++;
		}
		filter=filter.and(propertyFilter);
		return filter;
	},

	_makeStore: function(filter) {
		this._myStore = Ext.create('Rally.data.wsapi.Store', {
			model: 'userstory',
			autoLoad: true,
			showPagingToolbar: true,
			limit: 1000,
			filters: filter,
			listeners: {
				load: function(store, data, success) {
					this.sagaFeatures = data;
					var ids = _.map(data, function(item) {
						item.children = [];
						item.testCases = [];
						return item.get('ObjectID');
					});
					this._getAllChildren(ids);
				},
				scope: this
			},
			fetch: ['FormattedID', 'Name', '_ref', 'ObjectID', 'Owner', 'Status', 'Blocked', 'Project', 'Children', 
			'PlanEstimate', 'ScheduleState', 'c_TargetRelease', 'Tasks', 'TaskEstimateTotal', 'TaskRemainingTotal', 'c_StoryType', 'c_PriorityBin', 'TestCases', 
			'TestCaseStatus', 'Description', 'Iteration', 'Release', 'LastVerdict', 'Ready']
		});
	},
	
	_onDataLoaded: function() {
		var data = this.sagaFeatures;
		//console.log("on data loaded...");
		var filterString = Ext.getCmp('ScheduleStateCombobox').getValue() + '';
		var filters = filterString.split(',');
		var stories = [];
		this._totals = {
			totalStories: data.length,
			totalStoriesDraft: 0,
			totalStoriesDefined: 0,
			totalStoriesInProgress: 0,
			totalStoriesCompleted: 0,
			totalStoriesAccepted: 0,
			totalStoriesCA: 0,
			totalPointsAccepted: 0,
			totalStoriesEstimated: 0,
			totalPointsEstimated: 0,
			totalStoriesScheduled: 0,
			totalPlannedHours: 0,
			totalHoursRemaining: 0,
			totalHoursCompleted: 0
		};
		Ext.Array.each(data, function(story) {
			var s = {
				FormattedID: story.get('FormattedID'),
				Name: story.get('Name'),
				_ref: story.get("_ref"),
				Ready: story.get('Ready'),
				Owner: (story.get('Owner') && story.get('Owner')._refObjectName) || 'No Owner',
				Project: story.get('Project').Name,
				PlanEstimate: story.get('PlanEstimate') || 0,
				ScheduleState: story.get("ScheduleState"),
				Blocked: story.get('Blocked'),
				TargetRelease: story.get("c_TargetRelease"),
				PriorityBin: story.get('c_PriorityBin'),
				ChildrenCount: story.get("DirectChildrenCount"),
				TaskEstimateTotal: story.get('TaskEstimateTotal'),
				TaskRemainingTotal: story.get('TaskRemainingTotal'),
				TestCaseCount: 'EEK',
				TestCaseStatus: 'EEK',
				Children: [],
				TestCases: story.testCases,
				Points: [],
				TaskCompletedTotal : 0,
				CApts: 0,
				CAhrs: 0,
				Percentage: 0,
				hPercentage: 0
			};
			
			s.TaskCompletedTotal = s.TaskEstimateTotal - s.TaskRemainingTotal;
			
			switch (s.ScheduleState)
			{
			case "Draft":
				this._totals.totalStoriesDraft++;
				break;
			case "Defined":
				this._totals.totalStoriesDefined++;
				break;
			case "In-Progress":
				this._totals.totalStoriesInProgress++;
				break;
			case "Completed":
				this._totals.totalStoriesCompleted++;
				break;
			case "Accepted":
				this._totals.totalStoriesAccepted++;
				break;		
			}
			
			if (s.ScheduleState === 'Accepted' || s.ScheduleState === 'Completed') {
				this._totals.totalStoriesCA++;
				this._totals.totalPointsAccepted += s.PlanEstimate;
			}
			
			if (s.PlanEstimate !== 0) this._totals.totalStoriesEstimated++; 
			this._totals.totalPlannedHours += story.get('TaskEstimateTotal');
			this._totals.totalHoursRemaining += story.get('TaskRemainingTotal');
			this._totals.totalHoursCompleted += this._totals.totalPlannedHours - this._totals.totalHoursRemaining;
			this._totals.totalPointsEstimated += s.PlanEstimate;
			
			if (s.ChildrenCount === 0) {
				if (s.ScheduleState === 'Accepted' || s.ScheduleState === 'Completed') {				
					s.Points.push(s.PlanEstimate);
				}
			}
			
			_.forEach(story.children, function(child) {
				var iteration = child.get('Iteration');
				var release = child.get('Release');
				s.Children.push({
					_ref: child.get('_ref'),
					FormattedID: child.get('FormattedID'),
					Iteration: (iteration && iteration.Name) || 'Unscheduled',
					Release: (release && release.Name) || 'Unscheduled'
				});

				if (child.get('ScheduleState') == 'Completed' || child.get('ScheduleState') == 'Accepted') {
					
					s.Points.push(child.get('PlanEstimate'));
				}
			});
			
			s.CApts = _.reduce(s.Points, function(i, acc) {return (i || 0 ) + acc;}, 0);
			var planest = s.PlanEstimate;
			var percent = (s.CApts / planest) * 100 || 0;
			var hpercent = (s.TaskCompletedTotal / s.TaskEstimateTotal) * 100 || 0;
			s.Percentage = percent.toFixed(2) + "%";
			s.hPercentage = hpercent.toFixed(2) + "%";
			if (_.contains(filters, s.ScheduleState)) {
				stories.push(s);
			}
		}, this);
		this._createGrid(stories);
		window.stories = stories;
	},

	_createGrid: function(stories) {
		var myCustomStore = Ext.create('Rally.data.custom.Store', {
			data: stories,
			pageSize: 50
		});
		if (!this.grid) {
			this.grid = this.down('#gridCnt').add({
				xtype: 'rallygrid',
				id: 'dataGrid',
				showPagingToolbar: true,
				showRowActionsColumn: false,
				editable: false,
				flex: 1,
				store: myCustomStore,
				enableBlockedReasonPopover: false,
				columnCfgs: [{
						xtype: 'templatecolumn',
						text: 'ID',
						dataIndex: 'FormattedID',
						width: 80,
						tpl: Ext.create('Rally.ui.renderer.template.FormattedIDTemplate')
							//	tpl: '<a target=\"_blank\" href=\"https://rally1.rallydev.com/#/3961096544d/detail{_ref}\">{FormattedID}</a>' ,
					}, {
						text: 'Name',
						dataIndex: 'Name',
						minWidth: 270
					},
					{
						text: 'State',
						dataIndex: 'ScheduleState',
						xtype: 'templatecolumn',
						tpl: Ext.create('Rally.ui.renderer.template.ScheduleStateTemplate', {
							field: {
								getAllowedStringValues: function() {
									return ['Draft', 'Defined', 'In-Progress', 'Completed', 'Accepted'];
								},
								name: 'ScheduleState'
							}
						})
					},
					{
						text: 'Priority',
						dataIndex: 'PriorityBin'
					}, {
						text: 'Owner',
						dataIndex: 'Owner'
					}, {
						text: 'Project',
						dataIndex: 'Project'
					}, {
						text: 'T.Release',
						dataIndex: 'TargetRelease',
						width: 70
					}, {
						text: 'Completed Pts / Total Pts (%)',
					//	width: 170,
						xtype: 'templatecolumn',
						tpl: '{CApts} / {PlanEstimate} ({Percentage})'
					},
					{
						text: 'Completed Hrs / Total Hrs (%)',
						//width: 180,
						xtype: 'templatecolumn',
						tpl: '{TaskCompletedTotal} / {TaskEstimateTotal} ({hPercentage})'
					},
					{
						text: 'Leaf note stories & Iteration & Release Scheduled',
						dataIndex: 'Children',
						flex: 1,
						renderer: function(value) {
							var html = [];
							Ext.Array.each(value, function(child) {
								html.push('<a href="' + Rally.nav.Manager.getDetailUrl(child) + '">' + child.FormattedID + '</a>' + ' - ' + '<FONT COLOR="#B8860B">' + child.Iteration + '</FONT>' + ' - ' + child.Release);
							});
							return html.join('</br>');
						}
					}, 
					{
						text: 'TestCases-Verdict',
						dataIndex: 'TestCases',
						minWidth: 160,
						renderer: function(value) {
							var html = [];
							Ext.Array.each(value, function(testcase) {
								html.push('<a href="' + Rally.nav.Manager.getDetailUrl(testcase) + '">' + testcase.get('FormattedID') + '</a>' + '-' + testcase.get('LastVerdict'));
							});
							return html.join('</br>');
						}
					}
				]
			});
		}
		else {
			this.grid.reconfigure(myCustomStore);
			this.down('#dataGrid').setLoading(false);
			this._createPieChart();
			this._createChart();
		}
		
	},
	
	_createChart: function() {
		
		var chart = this.down('#chartCnt').add({
			xtype: 'rallychart',
			id: 'rollupChart',
			loadMask: false,
			chartConfig: {
				chart: {
					type: 'column',
					inverted: true,
					height: 270
				},
				title: {
					text: 'SAGA Feature % Completion'
				},
				xAxis: {
					
				},
				yAxis: {
					min: 0,
					labels: {
						formatter: function() {
							return this.value + '%';
						}
					},
					title: {
						text: null
					}
				}, 
				
				tooltip: {
					pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.y:.0f}</b> ({point.percentage:.0f}%)<br/>',
					shared: true
				},
				plotOptions: {
					column: {
						stacking: 'percent'
					}
				},
				legend: {
					reversed: true
				}
			},
			chartColors: ["#F6A900", "#8DC63F"],
			chartData: {
				categories: ['SAGA Features', 'Task Hours', 'Feature Points', '# Stories Estimated'],
				series: [ {
					name: 'Remaining',
					data: [(this._totals.totalStories-this._totals.totalStoriesCA), 
							this._totals.totalHoursRemaining, 
							(this._totals.totalPointsEstimated - this._totals.totalPointsAccepted), 
							(this._totals.totalStories - this._totals.totalStoriesEstimated)]
				}, {
					name: 'Completed',
					data: [this._totals.totalStoriesCA, 
							(this._totals.totalPlannedHours - this._totals.totalHoursRemaining), 
							this._totals.totalPointsAccepted, 
							this._totals.totalStoriesEstimated]
				}]
			}
		});
	},
	
	_createPieChart: function() {
		
		var pieChart = this.down('#piechartCnt').add({
			xtype: 'rallychart',
			id: 'rollupPieChart',
			loadMask: false,
			chartConfig: {
				chart: {
					plotBackgroundColor: null,
					plotBorderWidth: null,
					plotShadow: false,
					type: 'pie',
					height: 285
				},
				title: {
					text: 'State of SAGA Features'
				},
				tooltip: {
					pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
				},
				plotOptions: {
					pie: {
						allowPointSelect: true,
						cursor: 'pointer',
						dataLabels: {
							enabled: true,
							format: '<b>{point.name}</b>: {point.percentage:.1f} %'
						}
					//	showInLegend: true
					}
				}
			},	
			chartData: {
				series: [{
					name: "Rolled-up State",
					colorByPoint: true,
					data: [{
						name: "Draft",
						y: this._totals.totalStoriesDraft,
						color: '#cabc91'
					}, {
						name: "Defined",
						y: this._totals.totalStoriesDefined,
						color: '#F6A900'
					}, {
						name: "In-Progress",
						y: this._totals.totalStoriesInProgress,
						color: '#ffe555'
					}, {
						name: "Completed",
						y: this._totals.totalStoriesCompleted,
						color: '#6ecdff'
					}, {
						name: "Accepted",
						y: this._totals.totalStoriesAccepted,
						color: '#8DC63F'
					}]
				}]
			}
		});   
	}			
});
