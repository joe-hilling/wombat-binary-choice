
import './binary-choice.less'
import { screen, utils, controls } from 'wombat'
import template from './binary-choice.html'
import languages from './lang.json'

var ONCOMPLETE,
	CONFIG,
	LANG,
	IMAGES,
	COMBINATIONS,
	ACTIVE,
	TOTAL_COMBINATIONS,
	DATA = [],
	CURRENT


export default function(config, cb){
	
	CONFIG = config
	ONCOMPLETE = cb

	async.series([


		getLanguage,
		prepareConfig,
		buildUI

	], function(){
		next()

	})

}

function getLanguage(cb){
	LANG = utils.buildLanguage(languages, CONFIG)
	if(CONFIG.language_options){
		LANG = _.extend(LANG, CONFIG.language_options)
	}
	cb()
}


function prepareConfig(cb){

	// Check all the stimuli have a name and path field
	_.each(CONFIG.stimuli, function(s){
		if(!s.name) return alert('Missing field "name" in stimuli definition')
		if(!s.path) return alert('Missing field "path" in stimuli definition')
	})


	CONFIG.repeats = CONFIG.repeats || 1
	CONFIG.timer_duration = CONFIG.timer_duration || 3000
	CONFIG.delay = CONFIG.delay || 1000
	
	if(CONFIG.randomise === undefined) CONFIG.randomise = true
	if(CONFIG.fixed_words === undefined) CONFIG.fixed_words = true


	// Load the images
	utils.preloadImages(CONFIG.stimuli, function(images){
		// Store on outer scope
		IMAGES = images

		// Weave the image stimuli with the associations
		var combinations = [],
			imNames = _.keys(images),
			associations = CONFIG.associations


		for(var i=0 ; i< imNames.length-1 ; i++){
			for(var j=(i+1) ; j< imNames.length ; j++){
				combinations.push({
					stimuli1 : imNames[i],
					stimuli2 : imNames[j]
				})
				// Push both orientations
				combinations.push({
					stimuli1 : imNames[j],
					stimuli2 : imNames[i]
				})							
			}
		}
		
		// Replicate and shuffle these combinations
		combinations = utils.repeat(combinations, CONFIG.repeats)
		if(CONFIG.randomise){
			combinations = utils.shuffle(combinations)	
		}
		

		// Store on outer scope
		COMBINATIONS = combinations


		// Determine which word is on which side
		var rBool = Math.round(Math.random());

		if (rBool == 0 || CONFIG.fixed_words == true) {
			CONFIG.responseLeft  = CONFIG.response_1;
			CONFIG.responseRight = CONFIG.response_2;
		} else {
			CONFIG.responseLeft  = CONFIG.response_2;
			CONFIG.responseRight = CONFIG.response_1;
		}

		TOTAL_COMBINATIONS = COMBINATIONS.length

		cb()

	})

}

/*
	Build the user interface
*/
var mainScreen,
	_leftDisplay,
	_rightDisplay,
	_timer,
	_progress,
	_feedbackLeft,
	_feedbackRight,

	pauseScreen,
	_pauseContinue,
	_pause,

	introScreen



function feedbackSelection(selected){

	if(selected=='left'){
		_feedbackLeft.fadeIn('fast', function(){
			_feedbackLeft.fadeOut('slow')
		})
	} else {
		_feedbackRight.fadeIn('fast', function(){
			_feedbackRight.fadeOut('slow')
		})
	}

}

function buildUI(cb){


	var ui = $(template).clone()

	mainScreen = ui.find('.main')
	pauseScreen = ui.find('.pause-screen')

	// configure the pause screen
	pauseScreen.find('.message').html(LANG.pause_message)
	pauseScreen.find('input').val(LANG.pause_continue_button)
	_pauseContinue = pauseScreen.find('input')


	introScreen = ui.find('.introScreen')

	_leftDisplay = controls.display(mainScreen.find('.stimuli.left'))
	_rightDisplay = controls.display(mainScreen.find('.stimuli.right'))

	mainScreen.find('.title').html(LANG.title)
	mainScreen.find('.message-left').html(CONFIG.responseLeft.text)
	mainScreen.find('.message-right').html(CONFIG.responseRight.text)
	mainScreen.find('.select').each(function(){
		$(this).html(LANG.select)
	})


	_timer = controls.timer(mainScreen.find('.timer'))
		.duration(CONFIG.timer_duration || 5000)
		.timeout(outOfTime)


	if(CONFIG.delay < 300) _timer.resetDuration(1) // Makes the timer reset immediately


	Mousetrap.bind(['a','A'], function(){
		selected('left')
	})

	Mousetrap.bind(['l','L'], function(){
		selected('right')
	})


	mainScreen.find('.tap-top-left').on('touchend', function(){ selected('left')})
	mainScreen.find('.tap-main-left').on('touchend',function(){ selected('left')})
	mainScreen.find('.tap-top-right').on('touchend',function(){ selected('right')})
	mainScreen.find('.tap-main-right').on('touchend',function(){ selected('right')})

	mainScreen.find('.select-touch').html(LANG.tap)

	_feedbackLeft = mainScreen.find('.feedback-left')
	_feedbackRight = mainScreen.find('.feedback-right')

	_feedbackLeft.hide()
	_feedbackRight.hide()


	_progress = controls.progress(mainScreen.find('.progress'))

	_pause = controls.pause(mainScreen.find('.pause-button'))

	_pause.click(showPauseScreen)

	_progress.setTotal(COMBINATIONS.length)
	_progress.update(1)

	pauseScreen.hide()
	introScreen.hide()

	screen.enter(ui,'fade',cb)


}


/*
	Screen messages
*/
function showPauseScreen(){
	ACTIVE = false
	COMBINATIONS.push(CURRENT)
	_timer.stop()
	_timer.reset()
	_leftDisplay.hide()
	_rightDisplay.hide()

	function exitPauseScreen(){
		pauseScreen.fadeOut('slow', function(){
			_pauseContinue.off()
			mainScreen.fadeIn('slow', next)
		})
	}

	mainScreen.fadeOut('slow', function(){
		pauseScreen.fadeIn('slow', function(){

			_pauseContinue.click(exitPauseScreen)
		})
	})
}


function outOfTime(){

	ACTIVE = false
	interrupt(next)
}



function next()
{


	if (COMBINATIONS.length == 0)  return finishTest()

	_timer.reset()

	CURRENT = COMBINATIONS.shift();

	_progress.update(TOTAL_COMBINATIONS - COMBINATIONS.length)


	var imLeft = IMAGES[CURRENT.stimuli1].img
	var imRight = IMAGES[CURRENT.stimuli2].img

	_leftDisplay.hide()
	_rightDisplay.hide()

	_leftDisplay.set(imLeft)
	_rightDisplay.set(imRight)


	// Display the image after a delay
	utils.delay(CONFIG.delay, function(){

		_leftDisplay.domElement.fadeIn('fast')
		_rightDisplay.domElement.fadeIn('fast')


		ACTIVE = true

		// Start the timer 
		_timer.start()

	})

}

function interrupt(cb){
	ACTIVE = false
	COMBINATIONS.push(CURRENT) // recycle item
	_timer.stop()
	_timer.reset()
	
	cb()
}





function selected(type)
{
	if(!ACTIVE) return
	ACTIVE = false

	feedbackSelection(type)

	_timer.stop()


	function carryOn(){

		trackItem(type);
		next()
		
	}


	if(type=='left'){

		_leftDisplay.domElement.addClass('selected')

		_rightDisplay.domElement.fadeOut(300, function(){
			_leftDisplay.domElement.fadeOut(300, function(){
				_leftDisplay.domElement.removeClass('selected')
				carryOn()
			})
		})			
	} else {

		_rightDisplay.domElement.addClass('selected')
		_leftDisplay.domElement.fadeOut(300, function(){
			_rightDisplay.domElement.fadeOut(300, function(){
				_rightDisplay.domElement.removeClass('selected')
				carryOn()
			})
		})
	}

}





// This function is where gather data
function trackItem(selected)
{
	DATA.push({
		left : CURRENT.stimuli1,
		right : CURRENT.stimuli2,
		selected : selected,
		latency : _timer.value()
	})

}


function finishTest()
{
	screen.exit('fade', function(){
		var meta = buildMeta(DATA)
		ONCOMPLETE(meta, DATA)
	})

}


Mousetrap.bind(['a','A'], function(){
	selected('left')
})

Mousetrap.bind(['l','L'], function(){
	selected('right')
})







// Create some summary information that might be useful later
function buildMeta(data){
		var product_list = []
		var image_data = []
		var paired_data = {}
		var N_total = 0
		var n_selected= 0
		var lat = 0
		var total_latency_on_screen = 0
		_.each(data,function(o){ //create a list of products

			if(!_.includes(product_list,o.left)){
				product_list.push(o.left)
			}
			if(!_.includes(product_list,o.right)){
				product_list.push(o.right)
			}
		})
		_.each(data,function(o){ //generate the paired data information
			var reject = (o.selected=='left') ? o.right : o.left
			var key = JSON.stringify([o[o.selected], reject]) //creates the key of selected amnd rejected
			var opposite_key = JSON.stringify((JSON.parse(key)).reverse())
			if(paired_data[key]) //if the key exists, add extra data to it
			{
				paired_data[key].total_latency_for_selection = paired_data[key].total_latency_for_selection + o.latency
				paired_data[key].total_latency_pair = paired_data[key].total_latency_pair + o.latency
				paired_data[key].n = paired_data[key].n + 1
				paired_data[key].N = paired_data[key].N + 1
			} 
			else //else create the key
			{ 
				paired_data[key] = {
					"selected": o[o.selected],
					"reject":  reject,
					"n" : 1,
					"N" : 1,
					"total_latency_for_selection": o.latency,
					"total_latency_pair" : o.latency

				}

			}
		})
		var pair_total_N,
			pair_total_latency,
			image_object

		_.each(_.keys(paired_data),function(p){ //puts the extra layer of reveresed totals (ab and ba totals)
			var opposite_key = JSON.stringify((JSON.parse(p)).reverse())
			if(paired_data[p].N >paired_data[p].n ){}
			else if(paired_data[opposite_key]){
				pair_total_N = paired_data[p].N + paired_data[opposite_key].N
				paired_data[p].N = pair_total_N
				paired_data[opposite_key].N = pair_total_N

				pair_total_latency =  paired_data[p].total_latency_for_selection + paired_data[opposite_key].total_latency_for_selection
				paired_data[p].total_latency_pair = pair_total_latency
				paired_data[opposite_key].total_latency_pair = pair_total_latency
			}
			paired_data[p].average_latency_for_selection =Math.floor(paired_data[p].total_latency_for_selection / paired_data[p].n)
			paired_data[p].average_latency_pair =Math.floor(paired_data[p].total_latency_pair / paired_data[p].N)
		})
		_.each(product_list,function(img){ //cycle the images showm in the test
			_.each(data,function(o){ //pull out the info from the data to put into the image data
				if(img == o.left | img == o.right){ //calcualte the total amount of times the images come up
					N_total = N_total + 1
					total_latency_on_screen = total_latency_on_screen + o.latency
				}
				if(img == o[o.selected]){ // o[o.selected] is used to choose the chosen image in the current output data
					n_selected = n_selected + 1 //calculate the total time's it's selected
					lat = lat + o.latency //sum up the total latency for the image
				}

			})
			image_object = {}
			image_object['image'] = img
			image_object['N'] = N_total
			image_object['n'] = n_selected 
			image_object['total_latency_when_selected'] = lat 
			image_object['total_latency_on_screen'] = total_latency_on_screen 
			image_object['average_latency_when_selected'] = Math.floor(lat /n_selected)
			image_object['average_latency_on_screen'] = Math.floor(total_latency_on_screen /N_total)
			image_data.push(JSON.parse(JSON.stringify(image_object, null, 2))) //creates an a array of objects, each object is it's own iamge -> Maybe better to have an object with keys as the images then each has it#s own object
			N_total = 0
			n_selected= 0
			lat = 0
			total_latency_on_screen = 0

		})
		return {
			individual : image_data,
			paired : paired_data
		}
}

