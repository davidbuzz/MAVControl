////////////////////////////////////////////////////////////////////////////////////////////////////

//uses class EventEmitter from mav_v1.js a second time for wrapping the client-side parser with outgoing and incoming callback/s.
MSGHANDLER = function(a){
    this.a = a;
}

//var unused_socket_wrapper = function(message) {
   // if (message.type != 5  ) console.log('socket capture',message);
//}
// Implements EventEmitter
inherits(MSGHANDLER, EventEmitter);
var msghandler = new MSGHANDLER();
//msghandler.on('packet', unused_socket_wrapper);

////////////////////////////////////////////////////////////////////////////////////////////////////

var mavlink_outgoing_parser_message_handler = function(x,arguments) {

   event = arguments[0];
    //if (event != 'my_ping') {
    //    console.log('socket._emit ', arguments);
    //}

    if (event == 'do_change_mode') {  
        sysid = arguments[1]; 
        mode = arguments[2]; 
        var _mode_mapping_inv = mode_mapping_inv(); // comes from down below in mav-stuff.js
        var mode = mode.toUpperCase();
        var modenum = _mode_mapping_inv[mode];
        var target_system = sysid; 
        /* base_mode = 217, */ 
        var custom_mode = modenum; 

        // todo mav2
        set_mode_message = new mavlink10.messages.set_mode(target_system, mavlink10.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED, custom_mode); 

        // lookup and store the address/port we want it to go to for later elsewhere 
        udpserver.last_ip_address_out = sysid_to_ip_address[sysid]; 
        console.log('udpserver.last_ip_address_out = sysid_to_ip_address[sysid];');  
        console.log(udpserver.last_ip_address_out);
        console.log(sysid_to_ip_address); 
        //the above are both undefined. ip and port 
     
        console.log(`do_change_mode sysid: ${sysid} to mode: ${mode}`);  
        console.log(set_mode_message);  

        // finally this causes the parser to call into mavlink_emit_from_parser with the results and send them 
        // out the websocket, async, it's not done here.
        mavlinkParser1.send(set_mode_message);


    }

  // after turning into proper mavlink, emit it out the real websocket, not here tho.
  //_emit.apply(x, arguments);

}

////////////////////////////////////////////////////////////////////////////////////////////////////

// after INCOMiNG MAVLINK goes thru the mavlink parser in the browser, it dispatches them to here...
//  where we pull the relevant bits of the mavlink packets out into JSON and send them 
//  through the 'msghandler' EventEmitter to the 'msghandler.on(...)' calls to update the UI
var mavlink_incoming_parser_message_handler = function(message) {

    if (typeof message.header == 'undefined'){ 
        console.log('message.header UNDEFINED, skipping packet:'); 
        console.log(message); 
        return; 
    }


    // it's been parsed, and must be a valid mavlink packet, and thus must have a sysid available now..
    if (  sysid_to_ip_address[message.header.srcSystem] == null )  {
          console.log(`Got first PARSED MSG from sysid:${message.header.srcSystem} src:${udpserver.last_ip_address.address}:${udpserver.last_ip_address.port}, not repeating this. `);
    }
    //    keep a record of the sysid <-> ip address and port info on-hand for when we want to *send*.
    sysid_to_ip_address[message.header.srcSystem] = udpserver.last_ip_address;
            console.log("ASSIGNING:");             console.log(sysid_to_ip_address); 
    //sysid_to_mavlink_type[message.header.srcSystem] = udpserver.last_mavlink_type;

    // console.log all the uncommon message types we DONT list here.    
    if ( ! [ 'VFR_HUD','GPS_RAW_INT', 'ATTITUDE', 'SYS_STATUS', 'GLOBAL_POSITION_INT', 'HEARTBEAT','VIBRATION',
            'BATTERY_STATUS', 'TERRAIN_REPORT', 'WIND', 'HWSTATUS', 'AHRS', 'AHRS2', 'AHRS3',
            'SIMSTATE', 'RC_CHANNELS','RC_CHANNELS_RAW', 'SERVO_OUTPUT_RAW', 'LOCAL_POSITION_NED',
            'MEMINFO',  'POWER_STATUS', 'SCALED_PRESSURE', 'SCALED_IMU','SCALED_IMU2','SCALED_IMU3', 'RAW_IMU',
            'EKF_STATUS_REPORT', 'SYSTEM_TIME', 'MISSION_CURRENT' , 'SENSOR_OFFSETS', 
            'TIMESYNC', 'PARAM_VALUE', 'HOME_POSITION', 'POSITION_TARGET_GLOBAL_INT',
            'NAV_CONTROLLER_OUTPUT', 'STATUSTEXT' , 'COMMAND_ACK' , 
            'MISSION_ITEM', 'MISSION_ITEM_INT','MISSION_COUNT','MISSION_REQUEST', 'MISSION_ACK',
            'AIRSPEED_AUTOCAL', 'MISSION_ITEM_REACHED' , 'STAT_FLTTIME' ,'AUTOPILOT_VERSION' ,
             'FENCE_STATUS' , 'AOA_SSA' , 'GPS_GLOBAL_ORIGIN',  ].includes(message.name) ) { 
            
	console.log("unhandled mavlink packet"+message);
    } 


    // display STATUSTEXT as simple console.log
    if (  ['STATUSTEXT' ].includes(message.name) ) {
        // drop everything including and after the first null byte.
        message = message.text.replace(/\0.*$/g,'');
        console.log(`STATUSTEXT: ${message}`);
    } 

    if (  ['VFR_HUD' ].includes(message.name) ) {
        // this matches the json format sent by the non-mavlink backend server/s
        msghandler.emit('HUD',{sysid: message.header.srcSystem, airspeed: message.airspeed, 
                groundspeed: message.groundspeed, 
                heading: message.heading, throttle: message.throttle, 
                climb: message.climb, ap_type: "ArduPilot"});
    }

    if (  ['GLOBAL_POSITION_INT' ].includes(message.name) ) {
         // this matches the json format sent by the non-mavlink backend server/s
         msghandler.emit('location', { sysid: message.header.srcSystem,
                                lat: message.lat / 10000000 , 
                                lng: message.lon / 10000000, 
                                heading: message.hdg / 100,
                                altitude_agl: message.relative_alt / 1000 });
    }

    if (  ['SYS_STATUS' ].includes(message.name) ) {
         // this matches the json format sent by the non-mavlink backend server/s
         msghandler.emit('sys_status', { "sysid": message.header.srcSystem,
                                    "v1": message.voltage_battery, 
                                    "c1": message.current_battery, 
                                    "br": message.battery_remaining,
                                    "drop_rate_comm": message.drop_rate_comm,
                                    "errors_comm": message.errors_comm });
    }
    if (  ['ATTITUDE' ].includes(message.name) ) {
        // this matches the json format sent by the non-mavlink backend server/s
        msghandler.emit('attitude', { 'sysid': message.header.srcSystem,
                                  'pitch': message.pitch, 
                                  'roll': message.roll, 
                                  'yaw': message.yaw } );
    }
    if (  ['GPS_RAW_INT' ].includes(message.name) ) {
        // this matches the json format sent by the non-mavlink backend server/s
        msghandler.emit('gps_raw_int', { "sysid": message.header.srcSystem,
                                "raw_lat": message.lat / 10000000,
                                "raw_lng": message.lon / 10000000,
                                "raw_alt": message.alt / 1000,
                                "fix_type": message.fix_type,
                                "satellites_visible": message.satellites_visible,
                                "cog": message.cog });
    
    }
    if (  ['HEARTBEAT' ].includes(message.name) ) {
        // this matches the json format sent by the non-mavlink backend server/s

       // todo if needed
    }
 
    // add more MAVLINK -> to -> json handlers here for in-browser parsing.
}

////////////////////////////////////////////////////////////////////////////////////////////////////

var mode_mapping_apm = {
    0 : 'MANUAL',
    1 : 'CIRCLE',
    2 : 'STABILIZE',
    3 : 'TRAINING',
    4 : 'ACRO',
    5 : 'FBWA',
    6 : 'FBWB',
    7 : 'CRUISE',
    8 : 'AUTOTUNE',
    10 : 'AUTO',
    11 : 'RTL',
    12 : 'LOITER',
    14 : 'LAND',
    15 : 'GUIDED',
    16 : 'INITIALISING',
    17 : 'QSTABILIZE',
    18 : 'QHOVER',
    19 : 'QLOITER',
    20 : 'QLAND',
    21 : 'QRTL',
    22 : 'QAUTOTUNE',
    };

var mode_mapping_acm = {
    0 : 'STABILIZE',
    1 : 'ACRO',
    2 : 'ALT_HOLD',
    3 : 'AUTO',
    4 : 'GUIDED',
    5 : 'LOITER',
    6 : 'RTL',
    7 : 'CIRCLE',
    8 : 'POSITION',
    9 : 'LAND',
    10 : 'OF_LOITER',
    11 : 'DRIFT',
    13 : 'SPORT',
    14 : 'FLIP',
    15 : 'AUTOTUNE',
    16 : 'POSHOLD',
    17 : 'BRAKE',
    18 : 'THROW',
    19 : 'AVOID_ADSB',
    20 : 'GUIDED_NOGPS',
    21 : 'SMART_RTL',
    22 : 'FLOWHOLD',
    23 : 'FOLLOW',
};

function mode_mapping_inv() {

    var result = {};   // empty object to contain reversed key/value paris
    var keys = Object.keys(mode_mapping_apm);   // first get all keys in an array
    keys.forEach(function(key){
      var val = mode_mapping_apm[key];   // get the value for the current key
      result[val] = key;                 // reverse is done here
    });

	return result;
};

////////////////////////////////////////////////////////////////////////////////////////////////////

