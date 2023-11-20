function resetplot() { //reset the state of plot settings buttons and delete saved spectra
  $("#autoscalex").prop('checked', true).button("option", {icons: {primary: 'ui-icon-check'}}).button("refresh");
  $("#autoscaley").prop('checked', true).button("option", {icons: {primary: 'ui-icon-check'}}).button("refresh");
  $("#1stder").prop('checked', true).button("option", {icons: {primary: 'ui-icon-check'}}).button("refresh");
  $("#1stint").removeAttr("checked").button("option", {icons: {primary: 'ui-icon-close'}}).button("refresh");
  $("#2ndint").removeAttr("checked").button("option", {icons: {primary: 'ui-icon-close'}}).button("refresh");
  $("#seprt_scale").prop('checked', true).button("option", {icons: {primary: 'ui-icon-check'}}).button("refresh");
  dataarray.map(function (x) {return x.length = 1}); //delete overlapped spectra
  $("#ovlp").button("enable"); 
} //end function resetplot

function updateSliders(){ //update slides and then update plot
  for (var i = 0; i < settings.length; i++) {
    $("#"+i+"-value").val(settings[i][settings[i][0]+1]);
    $("#"+i).slider('value',settings[i][0]);
  }
  update();
}//end function updateSliders

function update() { //construct path from the settings.values, read the corresponding data file and draw plot.
  //file structure - assuming 4KB cluster size = 4096 bytes. Each file is 4kB and contains repeated pattern (x) of:
  //(a) 4 * 4 byte (32-bit) floats that describe Xmin, Xmax, Ymin, Ymax = 16 bytes
  //(b) 2-byte integers (y). The file has x data sets with y data points (integers) = (2y+16)x bytes. E.g., y=2048/x-8.
  //So if x=4, y=504, and you have a total of 4096 bytes.
  var str = root;
  for (var i = 0; i < settings.length-1; i++) { //construct path
    str += '/' + settings[i][0]; //generate path with a filename. 
  }
  var set_No = settings[settings.length-1][0]%No_sets+1; //The number of the dataset in the file. Basically, (last slider index)%No_sets+1
  str += String.fromCharCode(Math.ceil((settings[settings.length-1][0]+1)/No_sets)+96); //add the file index ("a", "b" etc) at the end of the filename - used if there are more than 10 steps in a slider. Basically, ceil((last slider index+1)/No_sets)
  parsefile(str, set_No, 0); //parse the file and draw the graph
} //end function update

function parsefile(filename, set_No, spectrum_No) { //function parses the file, modifies arrays XY and minmax, and draws the graph. spectrum_No shows which spectrum to modify (e.g., 0 is active spectrum)
  //Parameters: filename is the name (with full path!) of the file to download and parse
  //No_sets is the overall number of datasets in the file (x), set_No is the dataset No to return (starting with 1)
  ttp(1); //display tooltip after 0.5 s if the spectrum has not downloaded
  var oReq = new XMLHttpRequest();
  oReq.open("GET", filename, true);
  oReq.responseType = "arraybuffer";
  oReq.onload = function (oEvent) { //asynchronous!
    var arrayBuffer = oReq.response;
    var offset = (2*No_integers+16)*(set_No-1); //offset for the right dataset in bytes. This should be a whole number!
    var tmp = new DataView(arrayBuffer, offset, 16); //Have to use Dataview as float32 cannot start with an offset that is not a multiple of 4.
    for (var i = 0; i < minmax.length; i++) minmax[i] = tmp.getFloat32(i*4, littleEndian); //read floats; minmax[0-3] are xmin, xmax, ymin and ymax, respectively
    var data16 = new Uint16Array(arrayBuffer, offset+16, No_integers); //read data
    for (i = 0; i < XYint[spectrum_No].length; i++) {  //
      XYint[spectrum_No][i][0] = 10*(minmax[0]+i/(No_integers-1)*(minmax[1]-minmax[0])); //generate X values; multiply by 10 to convert from mT into Gauss
      XYint[spectrum_No][i][1] = minmax[2]+(minmax[3]-minmax[2])/65535*data16[i];
      XY[spectrum_No][i][0] = XYint[spectrum_No][i][0]; //assign X axes for double integrals etc
      XYdoubleint[spectrum_No][i][0] = XYint[spectrum_No][i][0];
    }
    XY[spectrum_No][0][1] = (XYint[spectrum_No][1][1]-XYint[spectrum_No][0][1])/(XYint[spectrum_No][1][0]-XYint[spectrum_No][0][0]); // differentiate and integrate. Use reverse difference rather than central difference (y[j+1]-y[j-1]) - OK?
    XYdoubleint[spectrum_No][0][1] = 0;
    for (var j = 1; j < XY[spectrum_No].length; j++) {
      XY[spectrum_No][j][1] = (XYint[spectrum_No][j][1]-XYint[spectrum_No][j-1][1])/(XYint[spectrum_No][j][0]-XYint[spectrum_No][j-1][0]);
      XYdoubleint[spectrum_No][j][1] = XYdoubleint[spectrum_No][j-1][1] + (XYint[spectrum_No][j][0]-XYint[spectrum_No][j-1][0])*(XYint[spectrum_No][j][1]+XYint[spectrum_No][j-1][1])/2;
    }
    graph(); //draw the graph
    ttp(0); //reset the tooltip when the new spectrum is displayed
  }
  oReq.send(null);
} //end function parsefile

function overlap(/*optional*/draw) { //copy active spectrum, integral etc to XY[1] etc
  var i = XY.length;
  for (j = 0; j<3; j++) {
    dataarray[j][i] = new Array(No_integers);//define new array element
    for (m = 0; m<No_integers; m++) {
      dataarray[j][i][m] = new Array(2);
      dataarray[j][i][m][0] = dataarray[j][0][m][0]; //copy all array elements - must be done this way to copy by value
      dataarray[j][i][m][1] = dataarray[j][0][m][1];
    } 
    if ($("#seprt_scale").is(":checked")) { //now copy min/max of the current axis to the new plot
      var k = j+3*i; //scale index
      var yax = (k<4)?"yaxis":"y"+(k-2)+"axis"; //name of the current yaxis
      var yaxnew = "y"+(k+1)+"axis"; //name of the new yaxis
      var axes = plot.getAxes();
      axes[yaxnew].min = axes[yax].min; //copy min/max to new axis
      axes[yaxnew].max = axes[yax].max;
    }
  }
  if (i==3) $("#ovlp").button("disable"); //disable any further overlaps
  if (!draw) graph();
} //end function overlap

function unoverlap() { //delete overlapped files
  dataarray.map(function (x) {return x.length = 1});
  $("#ovlp").button("enable"); 
  graph();
} //end function unoverlap

function graph(/*optional*/xmin,xmax,ymin,ymax) { //draw the graph
  //can overlap up to 3 plots in addition to the current plot - this makes up to 12 axes
  var series = new Array(); //plot series
  var checkbox = ["#1stder", "#1stint", "#2ndint"]; //names of checkboxes
  var minind=-Infinity, maxind=Infinity; 
  for (var i = 0; i < XY.length; i++) { //for current and each saved graph
    for (var j = 0; j<3; j++) {//for each of the spectra types,e.g., 1st der, 1st int, 2nd int
      var k = $("#seprt_scale").is(":checked")?j+3*i:j; //scale index - use either the same scale as the current plot, or separate scales
      var yax = (k<1)?"yaxis":"y"+(k+1)+"axis"; //name of the yaxis
      var slice=true, readY=false; //true if data slicing is needed , # is a flag that indicates whether min/max y need to be determined from the sliced data
      var sliceddata; //sliceddata holds the data for the plot
      if ($(checkbox[j]).is(":checked")) {
        var minind=-Infinity, maxind=Infinity; 
        if (xmin!==undefined) {//if zoom is initiated
          if (i==0) { //current plot
            options.xaxes[0].min = xmin; //set min/max for x
            options.xaxes[0].max = xmax;
            options.yaxes[k].min = ymin[k]; //set min/max for y
            options.yaxes[k].max = ymax[k];
            $("#autoscalex").removeAttr("checked").button("option", {icons: {primary: 'ui-icon-close'}}).button("refresh"); //chage the state of the buttons
            $("#autoscaley").removeAttr("checked").button("option", {icons: {primary: 'ui-icon-close'}}).button("refresh");
          }
          else { //for other plots, use the same min/max for x; 
            if ($("#seprt_scale").is(":checked")) { //for separate scales, read min/max for y; for the same scale, it is already set above at i=0
              options.yaxes[k].min = plot.getAxes()[yax].min;
              options.yaxes[k].max = plot.getAxes()[yax].max;
            }
          }
        }
        else { //not initiated by zoom
          if ($("#autoscalex").is(":checked")) { //if autoscale x
            if (i==0) {//current plot - find min/max for x and y, no slicing, whole data array used. For other plots, use the same min/max for x
              options.xaxes[0].min = Math.min.apply(Math, $.map(dataarray[j], function (v) {return v.map(function (x) {return x[0]})})); //build an array from x values for all saved components ($.map flattens this into one array) and find min/max for x
              options.xaxes[0].max = Math.max.apply(Math, $.map(dataarray[j], function (v) {return v.map(function (x) {return x[0]})}));
              slice=false;
            } 
          }
          else { //if not autoscale x, use previous min/max for x
            options.xaxes[0].min = (plot.getAxes().xaxis.min===-1)?Math.min.apply(Math, dataarray[j][i].map(function (x) {return x[0]})):plot.getAxes().xaxis.min;
            options.xaxes[0].max = (plot.getAxes().xaxis.max===1)?Math.max.apply(Math, dataarray[j][i].map(function (x) {return x[0]})):plot.getAxes().xaxis.max;
          }
          if ($("#autoscaley").is(":checked")) { //autoscale y
            if (i==0) readY=true; //current plot, find min/max for y
            else {
              if ($("#seprt_scale").is(":checked")) { //for separate scales, read min/max for y; for the same scale, it is already set above at i=0
                options.yaxes[k].min = (plot.getAxes()[yax].min===-1)?Math.min.apply(Math, dataarray[j][i].map(function (x) {return x[1]})):plot.getAxes()[yax].min;
                options.yaxes[k].max = (plot.getAxes()[yax].max===1)?Math.max.apply(Math, dataarray[j][i].map(function (x) {return x[1]})):plot.getAxes()[yax].max;
              }
            }
          }
          else { //if no autoscale y
            options.yaxes[k].min = (plot.getAxes()[yax].min===-1)?Math.min.apply(Math, dataarray[j][i].map(function (x) {return x[1]})):plot.getAxes()[yax].min;
            options.yaxes[k].max = (plot.getAxes()[yax].max===1)?Math.max.apply(Math, dataarray[j][i].map(function (x) {return x[1]})):plot.getAxes()[yax].max;
          }
        }
        if (slice) {
          for (var m = 0; m<XY[0].length; m++) { //prepare indices for slicing the data according to X range
            if (dataarray[j][i][m][0]>options.xaxes[0].min) {minind=m;break;}
          }
          for (var m = 0; m<XY[0].length; m++) {
            if (dataarray[j][i][m][0]>options.xaxes[0].max) {maxind=m-1;break;}
          }
          sliceddata = dataarray[j][i].slice(minind,maxind);
        }
        else {
          sliceddata = dataarray[j][i];
        }
        if (readY) {
          options.yaxes[k].min = Math.min.apply(Math, sliceddata.map(function (x) {return x[1]})); //set min/max for y
          options.yaxes[k].max = Math.max.apply(Math, sliceddata.map(function (x) {return x[1]}));
        }
        series.push({data:(sliceddata), yaxis:k+1, color:colors[i][j], shadowSize:0});
      }
    }
  }
  plot = $.plot($("#plot"), series, options); //must use this as otherwise axes min/max do not update
  $("#gfactor").css({top: plot.offset().top+2, left: plot.offset().left+2}); //update position of g factor and distance display. $.offset does not work on hidden elements.
  $("#distance").css({top: plot.offset().top+$('#gfactor').outerHeight(true)+4, left: plot.offset().left+2})
}  //end function graph


function plotandtooltips() {//makes divisions for plot and tooltips and binds them
  $("[title]").tooltip();
  $("[title]").each(function(){
    $(this).tooltip({ content: $(this).attr("title")});// It allows html content to tooltip.
  });
  $("#autoscalex").button({icons: {primary:'ui-icon-check'}}).focus(function () {this.blur()}).click(function () {$(this).button("option", {icons: {primary: this.checked ? 'ui-icon-check' : 'ui-icon-close'}}); graph();}); //focus on the plot for all button clicks; this makes sure they are not highlighted after click
  $("#autoscaley").button({icons: {primary:'ui-icon-check'}}).focus(function () {this.blur()}).click(function () {$(this).button("option", {icons: {primary: this.checked ? 'ui-icon-check' : 'ui-icon-close'}}); graph();});
  $("#1stder").button({icons: {primary:'ui-icon-check'}}).focus(function () {this.blur()}).click(function () {$(this).button("option", {icons: {primary: this.checked ? 'ui-icon-check' : 'ui-icon-close'}}); graph();});
  $("#1stint").button({icons: {primary:'ui-icon-close'}}).focus(function () {this.blur()}).click(function () {$(this).button("option", {icons: {primary: this.checked ? 'ui-icon-check' : 'ui-icon-close'}}); graph();});
  $("#2ndint").button({icons: {primary:'ui-icon-close'}}).focus(function () {this.blur()}).click(function () {$(this).button("option", {icons: {primary: this.checked ? 'ui-icon-check' : 'ui-icon-close'}}); graph();});
  $("#ovlp").button().focus(function () {this.blur()}).click(function () {overlap();});
  $("#seprt_scale").button({icons: {primary:'ui-icon-check'}}).focus(function () {this.blur()}).click(function () {$(this).button("option", {icons: {primary: this.checked ? 'ui-icon-check' : 'ui-icon-close'}}); graph();});
  $("#unovlp").button().focus(function () {this.blur()}).click(function () {unoverlap();});
  $("#showdata").button().focus(function () {this.blur()}).click(function () {showdata();});
  $("#reset").button().focus(function () {this.blur()}).click(function () {resetplot();graph();});
  $("#plot").bind("plotselected", function (event, ranges) { //function for plot selection
    try {
      xmin = ranges.xaxis.from;
      xmax = ranges.xaxis.to;
      var checkbox = ["#1stder", "#1stint", "#2ndint"]; //names of checkboxes
      for (i=0;i<3;i++) { //copy min/max for the X axis and Y, Yint and Ydoubleint axes for the 1st component only
        if ($(checkbox[i]).is(":checked")) {
          var yax = (i<1)?"yaxis":"y"+(i+1)+"axis"; //name of the yaxis
          ymin[i] = ranges[yax].from;
          ymax[i] = ranges[yax].to;
        }
      }
    }
    catch(e) {xmin = undefined;}
    graph(xmin,xmax,ymin,ymax);
    f1=null; //null is different from undefined - so distance is not measured after selection
    $("#distance").fadeOut(200);
    selected=true;
  });
  $("#plot").bind("plotclick", function (event, pos, item) {f1=(f1===null)?undefined:pos.x}); //first position to measure distance from. Do not measure after selection
  $("#plot").bind("plothover", function (event, pos, item) { //displays g factor
    var p = plot.getAxes();
    if (pos.x>p.xaxis.min && pos.x<p.xaxis.max && pos.y>p.yaxis.min && pos.y<p.yaxis.max) { //if mouse is within the plot
      var str = "g = " + (h*freq()/mu/pos.x).toFixed(5);
      $("#gfactor").html(str).fadeIn(200);
    } 
    else {f1=undefined;$("#gfactor").fadeOut(200);$("#distance").fadeOut(200);} //remove distance and g factor display (and reset distance) if the mouse moves outside the plot
    if (f1) $("#distance").html("&Delta;x = " + Math.abs(pos.x-f1).toPrecision(3) + " G").fadeIn(200); //distance
  });
} //end function plotandtooltips

function plotdivisions() { //makes divisions for plot and settings
  options = {//plot options
    selection: {mode: "xy"}, //enables selection for zooming in
    grid: {hoverable: true, clickable: true, autoHighlight: false}, //for tracking g factor and distances
    series:{lines:{lineWidth:1}}, 
    xaxes:[{axisLabel: "Magnetic field, G"}], 
    yaxes:[{autoscaleMargin: 0, axisLabel: "1st derivative, a.u."},{autoscaleMargin: 0, axisLabel: "1st integral, a.u."},{autoscaleMargin: 0, axisLabel: "2nd integral, a.u."},
           {autoscaleMargin: 0, axisLabel: "1st derivative, a.u., overlap 1"},{autoscaleMargin: 0, axisLabel: "1st integral, a.u., overlap 1"},{autoscaleMargin: 0, axisLabel: "2nd integral, a.u., overlap 1"},
           {autoscaleMargin: 0, axisLabel: "1st derivative, a.u., overlap 2"},{autoscaleMargin: 0, axisLabel: "1st integral, a.u., overlap 2"},{autoscaleMargin: 0, axisLabel: "2nd integral, a.u., overlap 2"},
           {autoscaleMargin: 0, axisLabel: "1st derivative, a.u., overlap 3"},{autoscaleMargin: 0, axisLabel: "1st integral, a.u., overlap 3"},{autoscaleMargin: 0, axisLabel: "2nd integral, a.u., overlap 3"}]
  };
  colors = [["rgb(255,0,0)","rgb(0,0,255)","rgb(0,204,0)"],["rgb(255,153,21)","rgb(255,0,255)","rgb(0,204,204)"],["rgb(102,0,0)","rgb(0,0,153)","rgb(0,102,0)"],["rgb(204,204,0)","rgb(178,102,255)","rgb(51,255,153)"]]; //array of plot colours
  $("#parms").after('<div id="plot"></div>');
  $("#plot").after('<div id="props"><em>Plot settings</em> <span class="question" title="If you just want to look at the spectra, you don\'t need to change the plot settings. </br></br>\
          When the mouse is hovering over the plot, the <strong>g factor</strong> corresponding to the current field position is shown in the top left corner.</br></br>\
          To measure the <strong>distance</strong> between peaks, click on the spectrum. The distance between the peaks (&Delta;x) will be shown under the g factor. Click\
          again to reset the distance. Move the mouse outside the plot to remove the distance display.</br></br>If you want to <strong>zoom in</strong>,\
          click and drag on the plot. Be aware, however, that the precision of these spectra is limited, so don\'t zoom in too far. To autoscale,\
          activate the <strong>Autoscale X </strong> or <strong>Autoscale Y </strong>buttons. The autoscale behaviour for multicomponent plots is complex but should hopefully be intuitive. Scaling does not \
          work for saved plots, so scale them before saving!</br></br>You can view a 1<sup>st</sup> derivative spectrum (usual representation of EPR data), or a 1<sup>st</sup> or double integral or any combination of these, depending \
          on the state of the corresponding buttons.</br></br>You can compare several simulations by saving plots. If you want to compare current spectrum\
          to further simulations, push the <strong>Save this spectrum</strong> button. You can either plot it on the same, or separate Y axis,\
          depending on whether the <strong>Separate Y axes for saved spectra</strong> button is activated. You can save up to three plots. To delete the saved \
          spectra, push the <strong>Delete saved spectra</strong> button. Clicking the <strong>Reset plot settings</strong> button will also delete all saved spectra and also reset the plot settings.</br></br>Click <strong>Show XY data</strong> button to display the data in two columns\
          in a separate window. You can then copy these data and paste them in another application such as a spreadsheet. Only data for 1<sup>st</sup> derivative spectrum are displayed.">?</span><br><br>\
      <input type="checkbox" id="autoscaley" checked><label for="autoscaley">Autoscale Y</label><br>\
      <input type="checkbox" id="autoscalex" checked><label for="autoscalex">Autoscale X</label><br>\
      <br><br>\
      <input type="checkbox" id="1stder" checked><label for="1stder">1st derivative</label><br>\
      <input type="checkbox" id="1stint"><label for="1stint">1st integral</label><br>\
      <input type="checkbox" id="2ndint"><label for="2ndint">2nd integral</label><br>\
      <br><br>\
      <button id = "ovlp">Save this spectrum?</button><br>\
      <input type="checkbox" id="seprt_scale" checked><label for="seprt_scale">Separate Y axes<br>for saved spectra</label><br>\
      <button id="unovlp">Delete saved spectra</button>\
      <button id="reset">Reset plot settings</button><br>\
      <br><br>\
      <button id="showdata">Show X,Y data</button>\
    </div>');
  $("body").prepend("<div id = 'gfactor'>t</div>");//append gfactor and distance. Add "t"so that it is not an empty division for calculating its size in the line below
  $("body").prepend("<div id = 'distance'></div>");
  $(window).on('resize', function() {
    $("#gfactor").css({top: plot.offset().top+2, left: plot.offset().left+2}); //update position of g factor and distance display on window resize.
    $("#distance").css({top: plot.offset().top+$('#gfactor').outerHeight(true)+4, left: plot.offset().left+2})
  })
}

function ttp(i) { //shows tooltip when the spectrum download is too slow. ttp(1) displays the tooltip, ttp(0) closes it
  if (i) {
    done = false;
    clearTimeout(mytimer); //clear previous timer and set the new one
    mytimer = setTimeout(function(){$('#tooltip').tooltip("open")}, 500)
  }
  else {
    clearTimeout(mytimer);$('#tooltip').tooltip("close") //clear timer and close the tooltip
    done=true;
  }
} //end function ttp

function showdata() { //opens a new window and prints an X,Y array
  newwindow = window.open('','name','width=400, scrollbars=1');
  var tmp = newwindow.document;
  tmp.write('<html><head><title>popup</title></head><body><table>');
  tmp.write('<tr><th>Field, G</th>');
  if ($("#1stder").is(':checked')) tmp.write('<th>Intensity (1st derivative)</th>'); //add titles for 1st derivative or 1st and 2nd integrals if selected
  if ($("#1stint").is(':checked')) tmp.write('<th>Intensity (1st integral)</th>');
  if ($("#2ndint").is(':checked')) tmp.write('<th>Intensity (2nd integral)</th>');
  tmp.write('</tr>');
  for (var i = 0; i<XY[0].length; i++) {
	  tmp.write('<tr><td>'+XY[0][i][0]+'</td>');
	  if ($("#1stder").is(':checked')) tmp.write('<td>'+XY[0][i][1]+'</td>');
	  if ($("#1stint").is(':checked')) tmp.write('<td>'+XYint[0][i][1]+'</td>');
	  if ($("#2ndint").is(':checked')) tmp.write('<td>'+XYdoubleint[0][i][1]+'</td>');
	  tmp.write('</tr>');
  }
  tmp.write('</table></body></html>');
  tmp.close();
} //end function showdata
