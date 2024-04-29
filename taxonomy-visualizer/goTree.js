var jq = $.noConflict();

var $ = go.GraphObject.make;
var diagram;
var nodeDataArray = [];
var colorScheme = ['#00579a', '#1967a4', '#3278ae', '#4c89b8', '#669ac2', '#7fabcc', '#99bbd6', '#b2cce0', '#ccddea', '#e5eef4', '#ffffff'].reverse();
var numColors = colorScheme.length;

function generateTree() {
	diagram =
		$(go.Diagram, "myDiagramDiv",
			{
				"undoManager.isEnabled": true,
				layout: $(go.TreeLayout, {
					angle: 0,
					layerSpacing: 35
				})
			});

	diagram.nodeTemplate =
		$(go.Node, "Vertical",

			{ isTreeExpanded: false, selectable: false },
			new go.Binding("background", "", (item) => {
				// 0 for default color, or items that are cited by none of the specs selected
				// 1 to highlight items that contain 1+ of the specs, but not all
				// 2 to highlight items that are cited by all specs selected
				rgb = item.rgb
				r = rgb[0];
				g = rgb[1];
				b = rgb[2];
				// item.highlight ? color = "#FFB3B3" : color = "rgb(" + r + "," + g + "," + b + ")";;
				c = item.highlight
				if (c == 0) {
					// shade of blue
					color = "rgb(" + r + "," + g + "," + b + ")"
				} else if (c == 1) {
					color = "#FFB3B3" // pink
				} else if (c == 2) {
					color = "#B3FFB3" // green
				} else if (c == 3) {
					color = "gold"
				} else if (c == 4) {
					color = "#F4E8FF" // purple
				}

				return color;
			}),

			// new go.Binding("background", "isHighlighted", (h) => {
			// 	if (h) {
			// 		return "gold"
			// 	} else {
			// 		return "white"
			// 	}

			// }).ofObject(),

			new go.Binding("visible", "visible", (visible) => { return visible }
			),

			// new go.Binding("strokeWidth", "highlight", function(v) { return v ? 3 : 1; })
			$(go.TextBlock, "Item text here",
				{ margin: 10, stroke: "black", width: 600, font: "16px sans-serif", wrap: go.TextBlock.WrapDesiredSize, textAlign: "left" },
				new go.Binding("text", "text")
			),

			$(go.TextBlock, "Item count here",
				{ margin: 10, stroke: "black", width: 600, font: "16px sans-serif", wrap: go.TextBlock.WrapDesiredSize, textAlign: "center" },
				new go.Binding("text", "statsOutput"),
				new go.Binding("visible", "isCat", (isCat) => { return isCat })
			),


			// $(go.TextBlock, "References here",
			// 	{ margin: 12, stroke: "black", width: 600, font: "16px sans-serif", wrap: go.TextBlock.WrapFit, textAlign: "center" },
			// 	new go.Binding("text", "references")),
			$("TreeExpanderButton",
				{
					alignment: go.Spot.Bottom, alignmentFocus: go.Spot.Top, width: 100,
					margin: new go.Margin(0, 0, 10, 0)
				},

				{ visible: true }
			),

			// shows if only one ref
			$(go.TextBlock, "One reference here",
				{ margin: new go.Margin(0, 5, 5, 5), stroke: "black", width: 600, font: "16px sans-serif", wrap: go.TextBlock.WrapDesiredSize, textAlign: "center" },
				new go.Binding("text", "refSet", (refSet) => { return refSet[0] }),
				new go.Binding("visible", "refSet", (refSet) => { return refSet.length === 1 })
			),
			// to list multiple refs
			$(go.Panel, "Table",
				$(go.TextBlock, "Show references",
					{
						column: 0, margin: new go.Margin(0, 5, 5, 5),
						font: "16px sans-serif"
					},
					new go.Binding("text", "refLabel")
				),
				$("PanelExpanderButton", "Ref", { column: 1 }),
				$(go.Panel, "Vertical",
					{
						name: "Ref", row: 1, column: 0, columnSpan: 2, visible: false
					},
					new go.Binding("itemArray", "refSet")
				),
				new go.Binding("visible", "refSet", (refSet) => { return refSet.length > 1 })
			),

			//Original text button
			$(go.Panel, "Table",
				$(go.TextBlock, "Original Text",
					{
						column: 0,
						margin: new go.Margin(5, 5, 5, 5),
						font: "16px sans-serif"
					}),
				$("PanelExpanderButton", "OriginalTextPanel", { column: 1 }),
				new go.Binding("visible", "key", key => { return !isCategory(key) })),

			$(go.Panel, "Vertical",
				{
					name: "OriginalTextPanel", row: 1, column: 0, columnSpan: 2, visible: false
				},
				$(go.TextBlock, "Original Text: ", {
					margin: 12,
					stroke: "black",
					width: 600,
					font: "16px sans-serif",
					wrap: go.TextBlock.WrapDesiredSize,
					textAlign: "left"
				}, new go.Binding("text", "origin")))
		);

	// define a Link template that routes orthogonally, with no arrowhead
	diagram.linkTemplate =
		$(go.Link,
			{ routing: go.Link.Orthogonal, corner: 35, selectable: false },
			$(go.Shape, // the link's path shape
				{ strokeWidth: 3, stroke: "#555" })
		);

	// m2 = new go.GraphLinksModel([
	// 	{
	// 		key: 1,
	// 		list1: ["one", "two", "three", "four", "five"],
	// 		list2: ["first", "second", "third", "fourth"]
	// 	}]);
	diagram.model = new go.TreeModel(nodeDataArray);
	console.log("nodeDataArray:");
	console.log(nodeDataArray);
}

// highlight differences ================================================================

var selectedRefs;

// When the checkbox is updated, i.e. something is checked/unchecked,
// an array of the checked refs needs to be created.
// This will be used to check if a node contains all refs in the array.
function checkBoxUpdated() {
	showHide = document.getElementById("showHide");
	checked = updateSelectedRefs();
	if (checked) { showHide.disabled = false }
	else { showHide.disabled = true; showHide.checked = false }

	// resetNodeHighlights();
	updateNodeHighlights();
	showHideBoxUpdated();
}

function showHideBoxUpdated() {
	// updateSelectedRefs();
	showHideUnselectedNodes();
}

function showHideUnselectedNodes() {
	let checked = showHide.checked
	for (i = 0; i < nodeDataArray.length; i++) {
		let c = nodeDataArray[i].highlight;
		if (checked && c == 0) { toggleShowHide(i, false) }
		else { toggleShowHide(i, true) }
	}
}

// toggles visibility of a node
function toggleShowHide(i, v) {
	diagram.model.commit((m) => {
		let data = m.nodeDataArray[i];  // get the first node data
		m.set(data, "visible", v);
	}, "flash");
}

//returns true if at least one checkboxes is selected
function updateSelectedRefs() {
	selectedRefs = [];
	output = false
	// iterate through all checkboxes
	jq(":checkbox").each(function (index, checkbox) {
		if (checkbox.name !== "showHide" && checkbox.checked) {
			let label = jq("label[for='" + jq(checkbox).attr('id') + "']")[0];
			selectedRefs.push(label.innerText);
			output = true
		}
	});
	console.log("Selected references: " + selectedRefs)
	return output
}

function resetNodeHighlights() {
	for (i = 0; i < nodeDataArray.length; i++) {
		toggle(i, 0)
	}
}

function updateNodeHighlights() {
	for (i = 0; i < nodeDataArray.length; i++) {
		let node = nodeDataArray[i].refSet.concat(Array.from(nodeDataArray[i].tarAudSet));
		highlight = nodeDataArray[i].defaultHL
		if (selectedRefs.length == 0) {
			c = highlight;
		} else if (!selectedRefs.every(ref => node.includes(ref)) && selectedRefs.some(ref => node.includes(ref))) {
			c = 1;
		} else if (selectedRefs.every(ref => node.includes(ref))) {
			// this else if is buggy, which leads to the requirement of two c=0 conditions, see above & below
			c = 2;
		} else {
			c = highlight;
		}
		toggle(i, c);
	}
}

// toggles bg color of a node
function toggle(i, c) {
	diagram.model.commit((m) => {
		let data = m.nodeDataArray[i];  // get the first node data
		m.set(data, "highlight", c);
	}, "flash");
}

// loading in nodes =====================================================================

// progress tracker for number of items placed in tree
var total = 0;
var count = 0;
var unique = 0; // this treats duplicates as 1 in the counts
var absUnique = 0; // this treats duplicates as 0 in the counts
var uniqueMap = new Map(); //maps nodes to number of unique items they have
var sortedUniqueMap;

function loadData() {
	openExcelAsJson();
	resetCheckboxes();
}

function openExcelAsJson() {
	//Reference the FileUpload element.
	let fileUpload = document.getElementById("inputFile");

	let reader = new FileReader();

	reader.onload = function (e) {
		getJSONExcel(e.target.result);
	};

	reader.readAsBinaryString(fileUpload.files[0]);

};

function getJSONExcel(data) {
	//Read the Excel File data in binary
	let workbook = XLSX.read(data, {
		type: 'binary'
	});

	//get the name of First Sheet.
	let firstSheet = workbook.SheetNames[0];

	//Read all rows from First Sheet into an JSON array.
	let jsonArray = XLSX.utils.sheet_to_row_object_array(workbook.Sheets[firstSheet]);
	console.log(jsonArray);
	// not sure how to move these two functions into loadData()
	// does not work if moved into loadData()
	createModelArray(jsonArray);
	generateTree();
	generateCheckBoxes();
	countUnique();
	printStats();
};

function generateCheckBoxes() {
	let checkBoxes = document.getElementById("checkBoxes");
	let refArrRoot = nodeDataArray[0].refSet;
	let tarAudArrRoot = nodeDataArray[0].tarAudSet;
	console.log(tarAudArrRoot)
	for (tarAud of tarAudArrRoot.values()) {
		console.log(tarAud)
		html = "<input type=\"checkbox\" onclick=\"checkBoxUpdated();\" id=\"" + tarAud + "\"><label for=\"" + tarAud + "\">" + tarAud + "</label > <br>"
		checkBoxes.innerHTML += html;
	}
	for (i = 0; i < refArrRoot.length; i++) {
		ref = refArrRoot[i]
		html = "<input type=\"checkbox\" onclick=\"checkBoxUpdated();\" id=\"" + ref + "\"><label for=\"" + ref + "\">" + ref + "</label > <br>"
		checkBoxes.innerHTML += html;
	}
}

function printStats() {
	duplicates = count - unique;
	console.log("---------------------------------------------")
	console.log("Unique items		: " + unique); // this treats duplicates as 1 in the counts
	console.log("Abs unique			: " + absUnique); // this treats duplicates as 0 in the counts
	console.log("Unique duplicates	: " + (unique - absUnique));
	console.log("Total duplicates	: " + duplicates);
	console.log("% Unique			: " + unique / count * 100 + " %");
	console.log("% Duplicate		: " + duplicates / count * 100 + " %");
	console.log("---------------------------------------------")
	console.log("Items added 		: " + count);
	console.log("Total       		: " + total);
	console.log("Progress    		: " + count / total * 100 + " %");
	console.log("Remaining   		: " + (total - count))
}

function isCategory(key) {
	return isNaN(key);
}

function createModelArray(jsonArray) {
	// initialize array
	for (i = 0; i < jsonArray.length; i++) {
		let item = jsonArray[i];

		// console.log("item: "+item)
		let isUnique = false;
		let isCat = true;

		if (!isCategory(item.key)) {// check if key is a number, i.e. item
			isCat = false
			if (typeof item.originalText !== 'undefined') {
				total += 1;
			}

		}

		// do not show nodes whose parents are actually leaves/items
		// leaves have keys represented by an integer number in the Excel file
		// if (/^-?\d+$/.test(item.parent)){ 
		//   continue;
		// }


		// omit nodes parent 0
		if (item.parent === '0') {
			continue;
		}

		// omit nodes with no assigned parent - for speed?
		if (typeof item.parent === 'undefined') {
			continue;
		}

		// omit duplicates, i.e. parent is a number
		// if(!isNaN(item.parent)){
		// 	continue;
		// }

		if (typeof item.text === 'undefined') {
			continue;
		}

		let tarAud = new Set();
		let ref = new Set();
		let children = new Set();
		let id = "(" + item.key + ") ";
		if(item.recTargetAudience){	id = id+"["+item.recTargetAudience+"] "; }
		let mainText = "";
		let originText = "This is a category. No original text.";
		// need a new way of creating refs, where the tree traversed started from leaf nodes
		if (typeof item.references !== 'undefined') {
			if(typeof item.recTargetAudience !== 'undefined'){
				ref.add(item.references.toString().concat(" (",item.recTargetAudience.toString(),")"));//replace(/ /g, "").split(","));
				item.recTargetAudience.split(", ").forEach(item => tarAud.add(item));
			} else {
				ref.add(item.references.toString());//replace(/ /g, "").split(","));
			}
			
			mainText = id + item.text;
			
		} else if (typeof item.originalText !== 'undefined') {
			mainText = id + item.text + ": " + item.originalText;
		} else {
			mainText = id + item.text;
		}

		if (typeof item.text === 'undefined') {
			mainText = id + item.originalText;
		}

		if (!isCategory(item.key)) {///^-?\d+$/.test(item.key)){
			hl = 4
			count += 1;
			originText = item.originalText;
			if (isCategory(item.parent)) { // parent is not a number, i.e. item
				unique += 1;
				isUnique = true;
			}
			n = item.key
		} else {
			hl = 0
			n = item.text
		}

		nodeDataArray.push({
			key: item.key,
			name: n,
			parent: item.parent,
			children: children,
			text: mainText,
			origin: originText,
			refSet: ref,
			references: "",
			refLabel: "",
			numItems: 0, // this is for categories only
			statsOutput: "",
			isUnique: isUnique,
			percentage: 0,
			rgb: 0,
			highlight: hl,
			defaultHL: hl,
			isCat: isCat,
			visible: true,
			tarAudSet: tarAud
		});
	}

	// fill in refSet and update numItems
	for (i = nodeDataArray.length - 1; i >= 0; i--) {
		let child = nodeDataArray[i];

		// append ref into refSets - add child to parent
		parent = nodeDataArray.find(node => node.key === child.parent)
		console.log(child)
		for (ref of child.refSet) {
			parent.refSet.add(ref);
		}
		for (tarAud of child.tarAudSet){
			parent.tarAudSet.add(tarAud)
		}
		parent.children.add(child.key);
	}

	// fill in refSet and update numItems - need second pass because children that are added after the node is attached to the parents will be missed
	for (i = nodeDataArray.length - 1; i >= 0; i--) {
		let child = nodeDataArray[i];

		// append ref into refSets - add child to parent
		parent = nodeDataArray.find(node => node.key === child.parent)
		for (ref of child.refSet) {
			parent.refSet.add(ref);
		}
		for (tarAud of child.tarAudSet){
			parent.tarAudSet.add(tarAud)
		}
		// update numItems count in parent
		if (isCategory(child.key)) {
			// console.log("-----------------------------------")
			// console.log(child.key)
			// console.log(child.parent)
			if (child.key !== 'root') {
				parent.numItems += child.numItems
				// console.log(child.numItems)
			}
		} else {
			parent.numItems += 1;
		}
	}

	// create itemCount/references text using numItems/refSets
	for (i = 0; i < nodeDataArray.length; i++) {
		let item = nodeDataArray[i];

		// references
		refArr = Array.from(item.refSet).sort();
		// item.references += "[";
		// for (j = 0; j < refArr.length; j++) {
		// 	item.references += refArr[j];
		// 	if (j < refArr.length - 1) { item.references += ", " };
		// }
		// item.references += "]";
		item.refSet = refArr;
		item.refLabel = "Show " + refArr.length + " reference(s)"

		// item counts
		// isCategory(item.key) ? prefix = "Unique item count: " : prefix = "Duplicate count: ";
		// item.statsOutput = prefix + item.numItems;

		isCategory(item.key) ? item.statsOutput = "Unique item count: " + item.numItems : item.statsOutput = null;
	}

	// calculate percentage
	let totalNumItems = nodeDataArray[0].numItems; // root has all items
	for (i = 0; i < nodeDataArray.length; i++) {
		let item = nodeDataArray[i];
		item.percentage = Math.round(item.numItems / totalNumItems * 100) / 100;
		p = item.numItems / totalNumItems; // denominator will be max, everything above it is same color

		r0 = 40;
		g0 = 140;
		b0 = 200;
		p = Math.min(1, p)
		function getColor(c) {
			return Math.min(255, c + (255 - c) * (1 - p));
		}
		r = getColor(r0);
		g = getColor(g0);
		b = getColor(b0);
		item.rgb = [r, g, b];

		if (isCategory(item.key)) { item.statsOutput += ", ratio: " + item.percentage * 100 + "%" };
	}

	// need to mark parents of duplicate childs as not unique, which is not done above
	for (i = 0; i < nodeDataArray.length; i++) {
		let item = nodeDataArray[i];
		if (!item.isUnique) {
			// find parent and set them as not unique, since it has a duplicate child
			let parent = nodeDataArray.find(element => {
				if (element.key === item.parent) { return element; }
			})
			parent.isUnique = false;
		}
	}

	// print all nodes at end
	for (i = nodeDataArray.length - 1; i >= 0; i--) {
		
		// console.log("Node:")
		// console.log(nodeDataArray[i])
		
	}
};

function countUnique() {
	// count number of unique items in each reference
	for (i = 0; i < nodeDataArray.length; i++) {
		let item = nodeDataArray[i];
		if (item.isUnique) {
			if (uniqueMap.has(item.references[0])) {
				uniqueMap.set(item.references[0], uniqueMap.get(item.references[0]) + 1);// increase count by 1
			} else {
				uniqueMap.set(item.references[0], 1);// set count to 1
			}
			absUnique += 1;
		}
	}
	sortedUniqueMap = new Map([...uniqueMap.entries()].sort());
}

// preprocessing - anything to be done prior to loading in file ============================

function preprocessing() {
	resetCheckboxes();
}

function resetCheckboxes() {
	jq(":checkbox").each(function (index, checkbox) {
		checkbox.checked = false;
	});
}

// search feature ===========================================================================
var highlightedNodes = []
// this function implemented with help from https://github.com/NorthwoodsSoftware/GoJS/blob/master/samples/orgChartStatic.html
function search() {
	console.log("searching")
	resetHighlights()
	var input = document.getElementById("searchInput")
	if (!input) return;
	diagram.focus()
	diagram.startTransaction("t")
	if (input.value) {
		// search four different data properties for the string, any of which may match for success
		// create a case insensitive RegExp from what the user typed
		var safe = input.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		var regex = new RegExp(safe, "i");
		var regex = new RegExp('/^a$/');
		for (i = 0; i < nodeDataArray.length; i++) {
			let item = nodeDataArray[i]
			// if (!isCategory(item.key)) { continue } // skip items 
			// result = item.key.match(regex) // change item."this_part"
			result = item.key.match(input.value)
			if (result !== null) {
				toggle(i, 3)
				highlightedNodes.push(i)
			}
		}
		results = diagram.findNodesByExample({ key: input.value }); // change {"this_part": regex}
		chainNodes = []
		while (results.next()) {
			node = results.value
			node.collapseTree()
			chainNodes.push(node)
			parent = node.findTreeParentNode()
			while (parent !== null) {
				chainNodes.push(parent)

				// this expands all nodes
				// no function available to expand only 1 level
				parent.expandTree()

				// we dont want to expand all nodes
				// check children of parent to see if it's in the returned results
				// if not, then collapse it
				children = parent.findTreeChildrenNodes()
				while (children.next()) {
					child = children.value
					if (!chainNodes.includes(child)) {
						child.collapseTree()
					}
				}
				parent = parent.findTreeParentNode()
			}
		}
		if (results.count > 0) diagram.centerRect(results.first().actualBounds);
	}
	diagram.commitTransaction("t")
}

function resetSearch() {
	resetHighlights()
	resetSearchBox()
}

function resetHighlights() {
	console.log("resetting")
	for (i = 0; i < highlightedNodes.length; i++) {
		index = highlightedNodes[i]
		toggle(index, 0)
	}
	highlightedNodes = []
}

function resetSearchBox() {
	document.getElementById("searchInput").value = ""
}

function resetAll() {
	diagram.focus()
	diagram.startTransaction("t")
	resetSearch();
	root = diagram.findNodeForKey('root')
	dfsCollapse(root)
	diagram.centerRect(root.actualBounds);
	diagram.focus()
	diagram.commitTransaction("t")
}

// buggy
function dfsCollapse(node) {
	if (node.isTreeExpanded === true) {
		console.log('collapsing: ' + node.key)
		// console.log("not expanded: " + node)
		// node.isTreeExpanded = false
		children = node.findTreeChildrenNodes()
		childArr = new Array()
		while (children.next()) {
			childArr.push(children.value)
		}
		console.log(childArr)
		for (i = 0; i < childArr.length; i++) {
			dfsCollapse(childArr[i])
		}
		node.collapseTree()
	} else {
		console.log('alrdy collapsed: ' + node.key)
	}
}