window.addEventListener('DOMContentLoaded', () => {

    let jsPDF;
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        console.error("jsPDF library not found. PDF export will be disabled.");
        const downloadPdfButton = document.getElementById('downloadPdfButton');
        if(downloadPdfButton) {
            downloadPdfButton.disabled = true;
            downloadPdfButton.title = "PDF-Bibliothek nicht geladen.";
            downloadPdfButton.style.opacity = "0.5";
            downloadPdfButton.style.cursor = "not-allowed";
        }
    } else {
        jsPDF = window.jspdf.jsPDF;
    }

    const DEFAULT_NUM_SEATS = 32;
    const DEFAULT_SEATS_PER_ROW = 8;
    const DEFAULT_SEATS_PER_PAIR = 2;
    const DEFAULT_PAIRS_PER_ROW = DEFAULT_SEATS_PER_ROW / DEFAULT_SEATS_PER_PAIR;
    const GROUP_COLORS_COUNT = 10;
    const EDITOR_ROWS = 6;
    const EDITOR_COLS = 9;
    const EDITOR_CELL_COUNT = EDITOR_ROWS * EDITOR_COLS;

    let plans = [];
    let activePlanId = null;

    let draggedSeatIndex = null;
    let draggedGroupInfo = null;
    let randomAnimationTimeoutId = null;
    let currentRandomHighlightIndex = -1;

    const tabBar = document.getElementById('tabBar');
    const addTabButton = document.getElementById('addTabButton');
    const classNameInput = document.getElementById('classNameInput');
    const roomNameInput = document.getElementById('roomNameInput');
    const commentInput = document.getElementById('commentInput');
    const groupEditorInput = document.getElementById('groupEditorInput');
    const studentNamesTextarea = document.getElementById('studentNames');
    const assignAllButton = document.getElementById('assignAllButton');
    const generateGroupsButton = document.getElementById('generateGroupsButton');
    const generateRandomGroupsButton = document.getElementById('generateRandomGroupsButton');
    const randomSelectButton = document.getElementById('randomSelectButton');
    const insertTestClassButton = document.getElementById('insertTestClassButton');
    const toggleRoomEditorButton = document.getElementById('toggleRoomEditorButton');
    const roomEditorContainer = document.getElementById('roomEditorContainer');
    const roomEditorGridDiv = document.getElementById('roomEditorGrid');
    const applyLayoutButton = document.getElementById('applyLayoutButton');
    const copyPlanButton = document.getElementById('copyPlanButton');
    const groupEditorContainer = document.getElementById('groupEditorContainer');
    const groupEditorColorSwatchesDiv = document.getElementById('groupEditorColorSwatches');
    const closeGroupEditorButton = document.getElementById('closeGroupEditorButton');
    const savePlanButton = document.getElementById('savePlanButton');
    const loadPlanButton = document.getElementById('loadPlanButton');
    const loadFileInput = document.getElementById('loadFileInput');
    const downloadPdfButton = document.getElementById('downloadPdfButton');
    const seatGridDiv = document.getElementById('seatGrid');
    const messageArea = document.getElementById('messageArea');

    const PREDEFINED_DEFAULT_LAYOUT_SEAT_DEFINITIONS = [];
    for (let r = 0; r < 4; r++) { // 4 rows
        for (let c = 0; c < 4; c++) { // First block of 4 columns
            PREDEFINED_DEFAULT_LAYOUT_SEAT_DEFINITIONS.push({ gridIndex: (r * EDITOR_COLS) + c });
        }
        for (let c = 5; c < 9; c++) { // Second block of 4 columns (cols 5,6,7,8 in editor)
            PREDEFINED_DEFAULT_LAYOUT_SEAT_DEFINITIONS.push({ gridIndex: (r * EDITOR_COLS) + c });
        }
    }


    // --- Plan- und Tab-Management ---
    function createNewPlan(name = `Plan ${plans.length + 1}`, copyFromPlan = null) {
        const planId = Date.now().toString() + Math.random().toString(36).substring(2,7);
        const newPlan = {
            planId: planId,
            planName: name,
            seatData: [],
            allParsedStudentsList: copyFromPlan ? JSON.parse(JSON.stringify(copyFromPlan.allParsedStudentsList)) : [],
            className: copyFromPlan ? copyFromPlan.className : "",
            roomName: copyFromPlan ? copyFromPlan.roomName : "",
            comment: copyFromPlan ? copyFromPlan.comment : "",
            groupSetting: copyFromPlan ? copyFromPlan.groupSetting : "",
            isCustomLayoutActive: copyFromPlan ? copyFromPlan.isCustomLayoutActive : false,
            customLayoutSeatDefinitions: copyFromPlan ? JSON.parse(JSON.stringify(copyFromPlan.customLayoutSeatDefinitions)) : [],
            NUM_SEATS_EFFECTIVE: copyFromPlan ? copyFromPlan.NUM_SEATS_EFFECTIVE : 0,
            minUsedRow: copyFromPlan ? copyFromPlan.minUsedRow : 0,
            maxUsedRow: copyFromPlan ? copyFromPlan.maxUsedRow : EDITOR_ROWS - 1,
            minUsedCol: copyFromPlan ? copyFromPlan.minUsedCol : 0,
            maxUsedCol: copyFromPlan ? copyFromPlan.maxUsedCol : EDITOR_COLS - 1,
            areGroupsActive: copyFromPlan ? copyFromPlan.areGroupsActive : false,
            finalRandomSeatIndex: -1
        };
        if (copyFromPlan && copyFromPlan.isCustomLayoutActive) {
            calculateUsedBoundsForPlan(newPlan);
        }
        initializeSeatDataForPlan(newPlan);
        return newPlan;
    }

    function initializeSeatDataForPlan(plan) {
        plan.seatData = [];
        for (let i = 0; i < plan.NUM_SEATS_EFFECTIVE; i++) {
            plan.seatData.push({
                id: i,
                originalGridIndex: plan.isCustomLayoutActive ? plan.customLayoutSeatDefinitions[i].gridIndex : null,
                student: null,
                isMarkedToKeepEmpty: false,
                colorState: 0,
                groupId: null,
                groupStyleType: null
            });
        }
    }

    function updateActivePlanDataFromUI() {
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (activePlan) {
            activePlan.className = classNameInput.value.trim();
            activePlan.roomName = roomNameInput.value.trim();
            activePlan.comment = commentInput.value.trim();
            activePlan.groupSetting = groupEditorInput.value.trim();
            parseStudentNamesAndUpdateActivePlan();
        }
    }


    function addTab() {
        updateActivePlanDataFromUI();
        const activePlanForCopy = plans.find(p => p.planId === activePlanId);
        const newPlan = createNewPlan(undefined, activePlanForCopy);
        plans.push(newPlan);
        setActivePlan(newPlan.planId);
    }

    function setActivePlan(planId) {
        if (activePlanId && activePlanId !== planId) {
            updateActivePlanDataFromUI();
        }

        activePlanId = planId;
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (activePlan) {
            classNameInput.value = activePlan.className || "";
            roomNameInput.value = activePlan.roomName || "";
            commentInput.value = activePlan.comment || "";
            groupEditorInput.value = activePlan.groupSetting || "";
            studentNamesTextarea.value = activePlan.allParsedStudentsList.map(s => s.originalName).join(',\n');

            const groupsButtonTextSpan = generateGroupsButton.querySelector('span[data-text-content]');
            if (groupsButtonTextSpan) {
                groupsButtonTextSpan.textContent = activePlan.areGroupsActive ? "Gr. löschen" : "Gruppen";
            }

            const roomEditorButtonTextSpan = toggleRoomEditorButton.querySelector('span[data-text-content]');
            if (roomEditorButtonTextSpan) {
                roomEditorButtonTextSpan.textContent = "Raumeditor";
            }

            // Ensure both panels are hidden when switching tabs
            roomEditorContainer.classList.add('hidden');
            groupEditorContainer.classList.add('hidden');

            if (plans.length > 1 && plans[0].planId !== activePlanId) {
                copyPlanButton.classList.remove('hidden');
                const sourcePlanName = plans[0].planName || "Plan 1";
                copyPlanButton.querySelector('span[data-text-content]').textContent = `Raumplan '${sourcePlanName.substring(0,10)}...'`;
            } else {
                copyPlanButton.classList.add('hidden');
            }


            renderTabs();
            renderGridForActivePlan();
        }
    }

    function renderTabs() {
        // Clear all but the add button
        while (tabBar.firstChild && tabBar.firstChild.id !== 'addTabButton') {
            tabBar.removeChild(tabBar.firstChild);
        }

        plans.forEach(plan => {
            const tabDiv = document.createElement('div');
            tabDiv.classList.add('tab');
            if (plan.planId === activePlanId) {
                tabDiv.classList.add('active');
            }
            tabDiv.dataset.planId = plan.planId;

            const nameSpan = document.createElement('span');
            nameSpan.textContent = plan.planName;
            nameSpan.title = "Klicken zum Umbenennen";
            nameSpan.classList.add('tab-name-display');
            tabDiv.appendChild(nameSpan);

            const editIcon = document.createElement('span');
            editIcon.classList.add('tab-action-icon');
            editIcon.innerHTML = '✎';
            editIcon.title = "Tab umbenennen";
            editIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                makeTabNameEditable(nameSpan, plan.planId);
            });
            tabDiv.appendChild(editIcon);


            const closeButton = document.createElement('span');
            closeButton.classList.add('tab-action-icon');
            closeButton.innerHTML = '&times;';
            closeButton.title = "Tab schließen";
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                closeTab(plan.planId);
            });
            tabDiv.appendChild(closeButton);

            tabDiv.addEventListener('click', () => setActivePlan(plan.planId));
            tabBar.insertBefore(tabDiv, addTabButton);
        });
    }

    function makeTabNameEditable(spanElement, planId) {
        const originalName = spanElement.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalName;
        input.classList.add('tab-input');

        spanElement.style.display = 'none';
        spanElement.parentNode.insertBefore(input, spanElement.nextSibling);
        input.focus();
        input.select();

        let finishedEditing = false;

        const finishEdit = (saveChanges) => {
            if (finishedEditing) return;
            finishedEditing = true;

            let newName = originalName;
            if (saveChanges) {
                newName = input.value.trim() || `Plan ${plans.findIndex(p => p.planId === planId) + 1}`;
            }

            const plan = plans.find(p => p.planId === planId);
            if (plan) {
                plan.planName = newName;
            }
            spanElement.textContent = newName;
            spanElement.style.display = '';
            if (input.parentNode) {
                input.remove();
            }
            input.removeEventListener('blur', handleBlur);
            input.removeEventListener('keydown', handleKeydown);
        };

        const handleBlur = () => {
            setTimeout(() => {
                if (document.body.contains(input)) {
                    finishEdit(true);
                }
            }, 50);
        };

        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                finishEdit(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                finishEdit(false);
            }
        };

        input.addEventListener('blur', handleBlur);
        input.addEventListener('keydown', handleKeydown);
    }


    function closeTab(planIdToClose) {
        if (plans.length <= 1) {
            messageArea.textContent = "Der letzte Tab kann nicht geschlossen werden.";
            return;
        }
        const planIndex = plans.findIndex(p => p.planId === planIdToClose);
        if (planIndex > -1) {
            plans.splice(planIndex, 1);
            if (activePlanId === planIdToClose) {
                setActivePlan(plans[0].planId);
            } else {
                renderTabs();
            }
        }
    }


    // --- Raumeditor Logik ---
    function createRoomEditorGrid() {
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (!activePlan) return;

        roomEditorGridDiv.innerHTML = '';
        roomEditorGridDiv.style.gridTemplateColumns = `repeat(${EDITOR_COLS}, 1fr)`;
        for (let i = 0; i < EDITOR_CELL_COUNT; i++) {
            const cell = document.createElement('div');
            cell.classList.add('editor-cell');
            cell.dataset.gridIndex = i;
            if (activePlan.customLayoutSeatDefinitions.some(def => def.gridIndex === i)) {
                cell.classList.add('selected');
            }
            cell.addEventListener('click', handleEditorCellClick);
            roomEditorGridDiv.appendChild(cell);
        }
    }

    function handleEditorCellClick(event) {
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (!activePlan) return;

        const gridIndex = parseInt(event.currentTarget.dataset.gridIndex);
        const selectedIndex = activePlan.customLayoutSeatDefinitions.findIndex(def => def.gridIndex === gridIndex);

        if (selectedIndex > -1) {
            activePlan.customLayoutSeatDefinitions.splice(selectedIndex, 1);
            event.currentTarget.classList.remove('selected');
        } else {
            activePlan.customLayoutSeatDefinitions.push({ gridIndex: gridIndex });
            event.currentTarget.classList.add('selected');
        }
    }

    // KORREKTUR: Vereinfachte Logik zum Umschalten der Sichtbarkeit
    toggleRoomEditorButton.addEventListener('click', () => {
        // Zuerst das andere Panel sicher ausblenden
        groupEditorContainer.classList.add('hidden');

        // Den Text des anderen Buttons zurücksetzen
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (activePlan) {
            generateGroupsButton.querySelector('span[data-text-content]').textContent = activePlan.areGroupsActive ? "Gr. löschen" : "Gruppen";
        }

        // Die Sichtbarkeit des Raumeditors umschalten
        roomEditorContainer.classList.toggle('hidden');

        // Button-Text basierend auf dem neuen Zustand aktualisieren
        const roomEditorButtonTextSpan = toggleRoomEditorButton.querySelector('span[data-text-content]');
        if (roomEditorContainer.classList.contains('hidden')) {
            roomEditorButtonTextSpan.textContent = "Raumeditor";
        } else {
            createRoomEditorGrid();
            roomEditorButtonTextSpan.textContent = "Editor aus";
        }
    });

    function calculateUsedBoundsForPlan(plan) {
        if (!plan.isCustomLayoutActive || plan.customLayoutSeatDefinitions.length === 0) {
            plan.minUsedRow = 0; plan.maxUsedRow = EDITOR_ROWS - 1;
            plan.minUsedCol = 0; plan.maxUsedCol = EDITOR_COLS - 1;
            return;
        }
        plan.minUsedRow = EDITOR_ROWS; plan.maxUsedRow = -1;
        plan.minUsedCol = EDITOR_COLS; plan.maxUsedCol = -1;

        plan.customLayoutSeatDefinitions.forEach(def => {
            const r = Math.floor(def.gridIndex / EDITOR_COLS);
            const c = def.gridIndex % EDITOR_COLS;
            if (r < plan.minUsedRow) plan.minUsedRow = r;
            if (r > plan.maxUsedRow) plan.maxUsedRow = r;
            if (c < plan.minUsedCol) plan.minUsedCol = c;
            if (c > plan.maxUsedCol) plan.maxUsedCol = c;
        });
        if (plan.minUsedRow > plan.maxUsedRow) { plan.minUsedRow = 0; plan.maxUsedRow = 0; }
        if (plan.minUsedCol > plan.maxUsedCol) { plan.minUsedCol = 0; plan.maxUsedCol = 0; }
    }


    applyLayoutButton.addEventListener('click', () => {
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (!activePlan) return;

        if (activePlan.customLayoutSeatDefinitions.length === 0) {
            activePlan.isCustomLayoutActive = false;
            activePlan.NUM_SEATS_EFFECTIVE = 0;
            messageArea.textContent = "Keine Plätze im Editor ausgewählt. Layout nicht geändert.";
        } else {
            activePlan.isCustomLayoutActive = true;
            activePlan.NUM_SEATS_EFFECTIVE = activePlan.customLayoutSeatDefinitions.length;
            activePlan.customLayoutSeatDefinitions.sort((a,b) => a.gridIndex - b.gridIndex);
            calculateUsedBoundsForPlan(activePlan);
            messageArea.textContent = `Layout mit ${activePlan.NUM_SEATS_EFFECTIVE} Plätzen angewendet.`;
        }
        initializeSeatDataForPlan(activePlan);
        renderGridForActivePlan();
        roomEditorContainer.classList.add('hidden');
        toggleRoomEditorButton.querySelector('span[data-text-content]').textContent = "Raumeditor";
    });

    function renderGridForActivePlan() {
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (activePlan) {
            renderGrid(activePlan);
        } else if (plans.length > 0) {
            setActivePlan(plans[0].planId);
        } else {
            seatGridDiv.innerHTML = '<p style="text-align: center; color: #6B7280; grid-column: 1 / -1; padding: 2.5rem 0;">Erstelle zuerst einen Raumplan mit dem Raumeditor oder lade einen bestehenden Plan!</p>';
            seatGridDiv.className = 'custom-layout-active-grid';
            seatGridDiv.style.gridTemplateColumns = '1fr';
            seatGridDiv.style.maxWidth = '600px';
            seatGridDiv.style.margin = '0 auto';
        }
    }

    function renderGrid(plan) {
        messageArea.textContent = '';
        seatGridDiv.innerHTML = '';

        if (plan.NUM_SEATS_EFFECTIVE === 0 && !plan.isCustomLayoutActive) {
            seatGridDiv.innerHTML = '<p style="text-align: center; color: #6B7280; grid-column: 1 / -1; padding: 2.5rem 0;">Erstelle zuerst einen Raumplan mit dem Raumeditor oder lade einen bestehenden Plan!</p>';
            seatGridDiv.className = 'custom-layout-active-grid';
            seatGridDiv.style.gridTemplateColumns = '1fr';
            seatGridDiv.style.maxWidth = '600px';
            seatGridDiv.style.margin = '0 auto';
            return;
        }

        if (plan.isCustomLayoutActive) {
            seatGridDiv.className = 'custom-layout-active-grid';
            const numActiveCols = (plan.maxUsedCol - plan.minUsedCol + 1);
            seatGridDiv.style.gridTemplateColumns = `repeat(${numActiveCols}, 1fr)`;

            const desiredSeatWidthInCustomGrid = 85;
            const gapBetweenSeats = 4;
            seatGridDiv.style.maxWidth = `${numActiveCols * desiredSeatWidthInCustomGrid + (numActiveCols > 1 ? (numActiveCols - 1) * gapBetweenSeats : 0)}px`;
            seatGridDiv.style.margin = '0 auto';


            for (let r = plan.minUsedRow; r <= plan.maxUsedRow; r++) {
                for (let c = plan.minUsedCol; c <= plan.maxUsedCol; c++) {
                    const editorGridIdx = r * EDITOR_COLS + c;
                    const seatInfoForThisCell = plan.seatData.find(sd => sd.originalGridIndex === editorGridIdx);

                    if (seatInfoForThisCell) {
                        const seatDataIndex = plan.seatData.indexOf(seatInfoForThisCell);
                        const seatDiv = createSeatElement(seatInfoForThisCell, seatDataIndex, plan);
                        seatGridDiv.appendChild(seatDiv);
                    } else {
                        const placeholderCell = document.createElement('div');
                        placeholderCell.classList.add('editor-placeholder-cell');
                        seatGridDiv.appendChild(placeholderCell);
                    }
                }
            }
        } else if (plan.NUM_SEATS_EFFECTIVE > 0) {
            seatGridDiv.className = 'default-layout';
            seatGridDiv.style.maxWidth = '1400px';
            seatGridDiv.style.margin = '';


            const defaultLayoutSeatElements = [];
            plan.seatData.forEach((seatInfo, index) => {
                const seatDiv = createSeatElement(seatInfo, index, plan);
                defaultLayoutSeatElements.push(seatDiv);
            });


            for (let r = 0; r < DEFAULT_NUM_SEATS / DEFAULT_SEATS_PER_ROW; r++) {
                const rowContainerDiv = document.createElement('div');
                rowContainerDiv.className = 'seat-row-container';

                const leftHalfDiv = document.createElement('div');
                leftHalfDiv.className = 'half-row';

                const rightHalfDiv = document.createElement('div');
                rightHalfDiv.className = 'half-row';

                for (let p = 0; p < DEFAULT_PAIRS_PER_ROW; p++) {
                    const pairDiv = document.createElement('div');
                    pairDiv.className = 'pair-div';

                    const seat1IndexInDefaultLayout = r * DEFAULT_SEATS_PER_ROW + p * DEFAULT_SEATS_PER_PAIR;
                    const seat2IndexInDefaultLayout = seat1IndexInDefaultLayout + 1;

                    if (defaultLayoutSeatElements[seat1IndexInDefaultLayout]) pairDiv.appendChild(defaultLayoutSeatElements[seat1IndexInDefaultLayout]);
                    if (defaultLayoutSeatElements[seat2IndexInDefaultLayout]) pairDiv.appendChild(defaultLayoutSeatElements[seat2IndexInDefaultLayout]);

                    if (p < DEFAULT_PAIRS_PER_ROW / 2) {
                        leftHalfDiv.appendChild(pairDiv);
                    } else {
                        rightHalfDiv.appendChild(pairDiv);
                    }
                }
                rowContainerDiv.appendChild(leftHalfDiv);
                rowContainerDiv.appendChild(rightHalfDiv);
                seatGridDiv.appendChild(rowContainerDiv);
            }
        }
    }

    function createSeatElement(seatInfo, index, plan) {
        const seatDiv = document.createElement('div');
        seatDiv.id = `seat-${index}`;
        seatDiv.dataset.index = index;
        seatDiv.classList.add('seat');

        seatDiv.classList.remove('occupied', 'empty', 'color-green', 'color-yellow', 'color-red', 'random-selected-final', 'random-highlight-animation');
        for (let k = 0; k < GROUP_COLORS_COUNT; k++) {
            seatDiv.classList.remove(`group-fill-${k}`);
            seatDiv.classList.remove(`group-stripes-${k}`);
        }

        if (seatInfo.groupId !== null) {
            const colorIndex = seatInfo.groupId % GROUP_COLORS_COUNT;
            if (seatInfo.groupStyleType === 'stripes') {
                seatDiv.classList.add(`group-stripes-${colorIndex}`);
            } else {
                seatDiv.classList.add(`group-fill-${colorIndex}`);
            }
        } else if (seatInfo.colorState === 1) { seatDiv.classList.add('color-green'); }
        else if (seatInfo.colorState === 2) { seatDiv.classList.add('color-yellow'); }
        else if (seatInfo.colorState === 3) { seatDiv.classList.add('color-red'); }
        else { if (seatInfo.student) { seatDiv.classList.add('occupied'); } else { seatDiv.classList.add('empty'); } }


        if (seatInfo.student) {
            const studentObject = plan.allParsedStudentsList.find(s => s.originalName === seatInfo.student);
            let displayName = studentObject ? studentObject.displayName : seatInfo.student.replace(/[\d*]+$/, '').trim();
            const firstSpace = displayName.indexOf(' ');
            if (firstSpace > 0 && displayName.substring(firstSpace + 1).trim() !== "") {
                displayName = displayName.substring(0, firstSpace) + "<br>" + displayName.substring(firstSpace + 1);
            }
            seatDiv.innerHTML = `<span class="seat-name">${displayName}</span>`;
            seatDiv.draggable = true;
        } else {
            seatDiv.innerHTML = `<span class="seat-name">Frei</span>`;
            seatDiv.draggable = false;
        }

        if (seatInfo.isMarkedToKeepEmpty) { seatDiv.classList.add('keep-empty-selected'); }
        else { seatDiv.classList.remove('keep-empty-selected'); }

        if (index === plan.finalRandomSeatIndex) { seatDiv.classList.add('random-selected-final'); }

        seatDiv.addEventListener('click', handleSeatClick);
        seatDiv.addEventListener('contextmenu', handleSeatRightClick);
        seatDiv.addEventListener('dragstart', handleDragStart);
        seatDiv.addEventListener('dragend', handleDragEnd);
        seatDiv.addEventListener('dragover', handleDragOver);
        seatDiv.addEventListener('dragenter', handleDragEnter);
        seatDiv.addEventListener('dragleave', handleDragLeave);
        seatDiv.addEventListener('drop', handleGroupDrop);
        return seatDiv;
    }

    function handleSeatClick(event) {
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (!activePlan) return;
        const seatIndex = parseInt(event.currentTarget.dataset.index);
        activePlan.seatData[seatIndex].isMarkedToKeepEmpty = !activePlan.seatData[seatIndex].isMarkedToKeepEmpty;
        renderGridForActivePlan();
    }

    function handleSeatRightClick(event) {
        event.preventDefault();
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (!activePlan) return;
        const seatIndex = parseInt(event.currentTarget.dataset.index);
        activePlan.seatData[seatIndex].colorState = (activePlan.seatData[seatIndex].colorState + 1) % 4;
        activePlan.seatData[seatIndex].groupId = null;
        activePlan.seatData[seatIndex].groupStyleType = null;
        renderGridForActivePlan();
    }


    function handleDragStart(event) {
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (!activePlan) return;

        if (event.currentTarget.classList.contains('color-swatch')) {
            draggedGroupInfo = {
                groupId: parseInt(event.currentTarget.dataset.groupId),
                groupStyleType: event.currentTarget.dataset.groupStyleType
            };
            event.dataTransfer.setData('text/plain', 'group-swatch');
        } else if (event.currentTarget.classList.contains('seat')) {
            const seatIndex = parseInt(event.currentTarget.dataset.index);
            if (!activePlan.seatData[seatIndex].student) {
                event.preventDefault();
                return;
            }
            draggedSeatIndex = seatIndex;
            event.dataTransfer.setData('text/plain', seatIndex.toString());
        }
        if(event.currentTarget.classList.contains('seat')) event.currentTarget.classList.add('dragging');
    }

    function handleDragEnd(event) {
        if(event.currentTarget.classList.contains('seat')) event.currentTarget.classList.remove('dragging');
        document.querySelectorAll('.seat.drag-over-target').forEach(seat => {
            seat.classList.remove('drag-over-target');
        });
        draggedSeatIndex = null;
        draggedGroupInfo = null;
    }

    function handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnter(event) {
        event.preventDefault();
        if (event.currentTarget.classList.contains('seat')) {
            event.currentTarget.classList.add('drag-over-target');
        }
    }

    function handleDragLeave(event) {
        if (event.currentTarget.classList.contains('seat')) {
            event.currentTarget.classList.remove('drag-over-target');
        }
    }

    function handleGroupDrop(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('drag-over-target');
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (!activePlan) return;
        const targetSeatIndex = parseInt(event.currentTarget.dataset.index);

        if (draggedGroupInfo) {
            activePlan.seatData[targetSeatIndex].groupId = draggedGroupInfo.groupId;
            activePlan.seatData[targetSeatIndex].groupStyleType = draggedGroupInfo.groupStyleType;
            activePlan.seatData[targetSeatIndex].colorState = 0;
            activePlan.areGroupsActive = true;
            const groupsButtonTextSpan = generateGroupsButton.querySelector('span[data-text-content]');
            if (groupsButtonTextSpan) {
                groupsButtonTextSpan.textContent = "Gr. löschen";
            }
        } else if (draggedSeatIndex !== null) {
            if (draggedSeatIndex === targetSeatIndex) {
                draggedSeatIndex = null;
                return;
            }
            const studentToMove = activePlan.seatData[draggedSeatIndex].student;
            const studentAtTarget = activePlan.seatData[targetSeatIndex].student;

            activePlan.seatData[targetSeatIndex].student = studentToMove;
            activePlan.seatData[draggedSeatIndex].student = studentAtTarget;

            activePlan.seatData[targetSeatIndex].isMarkedToKeepEmpty = false;
            activePlan.seatData[targetSeatIndex].groupId = null;
            activePlan.seatData[targetSeatIndex].groupStyleType = null;
            activePlan.seatData[targetSeatIndex].colorState = 0;
            activePlan.seatData[draggedSeatIndex].groupId = null;
            activePlan.seatData[draggedSeatIndex].groupStyleType = null;
            activePlan.seatData[draggedSeatIndex].colorState = 0;
        }

        const draggedElement = document.getElementById(`seat-${draggedSeatIndex}`);
        if (draggedElement) draggedElement.classList.remove('dragging');

        draggedSeatIndex = null;
        draggedGroupInfo = null;
        renderGridForActivePlan();
    }

    function parseStudentNamesAndUpdateActivePlan() {
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (!activePlan) return [];

        const namesStringWithMixedDelimiters = studentNamesTextarea.value.trim();
        if (!namesStringWithMixedDelimiters) {
            activePlan.allParsedStudentsList = [];
            return [];
        }

        const namesStringOnlyCommas = namesStringWithMixedDelimiters.replace(/\r\n|\r|\n/g, ',');

        activePlan.allParsedStudentsList = namesStringOnlyCommas.split(',')
            .map(name => name.trim())
            .filter(name => name.length > 0)
            .map(originalName => {
                let displayName = originalName;
                let groupKey = null;
                let isNoNeighbor = false;

                if (displayName.endsWith('*')) {
                    isNoNeighbor = true;
                    displayName = displayName.slice(0, -1).trim();
                }
                const numberMatch = displayName.match(/^(.*?)(\d+)$/);
                if (numberMatch) {
                    displayName = numberMatch[1].trim();
                    groupKey = numberMatch[2];
                }
                return { originalName, displayName, groupKey, isNoNeighbor };
            });
        return activePlan.allParsedStudentsList;
    }

    function getVisualNeighborIndices(seatIndex, plan) {
        const neighbors = [];
        if (plan.isCustomLayoutActive) {
            const originalGridIdx = plan.seatData[seatIndex].originalGridIndex;
            if (originalGridIdx === null) return [];

            const row = Math.floor(originalGridIdx / EDITOR_COLS);
            const col = originalGridIdx % EDITOR_COLS;

            const potentialGridIndices = [
                (row - 1) * EDITOR_COLS + col,
                (row + 1) * EDITOR_COLS + col,
                row * EDITOR_COLS + (col - 1),
                row * EDITOR_COLS + (col + 1)
            ];
            if (col === 0) potentialGridIndices[2] = -1;
            if (col === EDITOR_COLS - 1) potentialGridIndices[3] = -1;


            potentialGridIndices.forEach(gridIdx => {
                if (gridIdx >= 0 && gridIdx < EDITOR_CELL_COUNT) {
                    const neighborSeat = plan.seatData.find(s => s.originalGridIndex === gridIdx);
                    if (neighborSeat) {
                        neighbors.push(plan.seatData.indexOf(neighborSeat));
                    }
                }
            });
            return neighbors;
        }
        const defaultRow = Math.floor(seatIndex / DEFAULT_SEATS_PER_ROW);
        const defaultColInRow = seatIndex % DEFAULT_SEATS_PER_ROW;

        const pairMate = (defaultColInRow % 2 === 0) ? seatIndex + 1 : seatIndex - 1;
        if (pairMate >= defaultRow * DEFAULT_SEATS_PER_ROW && pairMate < (defaultRow + 1) * DEFAULT_SEATS_PER_ROW) {
            neighbors.push(pairMate);
        }

        if (defaultColInRow === 2) neighbors.push(seatIndex - 1);
        if (defaultColInRow === 6) neighbors.push(seatIndex - 1);
        if (defaultColInRow === 1) neighbors.push(seatIndex + 1);
        if (defaultColInRow === 5) neighbors.push(seatIndex + 1);

        return neighbors.filter(idx => idx >= 0 && idx < plan.NUM_SEATS_EFFECTIVE);
    }

    function canPlaceStudent(studentToPlace, targetSeatIndex, currentPlanState) {
        if (!studentToPlace.isNoNeighbor) {
            return true;
        }
        const visualNeighbors = getVisualNeighborIndices(targetSeatIndex, currentPlanState);
        for (const neighborIdx of visualNeighbors) {
            const neighborSeatInfo = currentPlanState.seatData[neighborIdx];
            if (neighborSeatInfo && neighborSeatInfo.student) {
                const neighborStudentObject = currentPlanState.allParsedStudentsList.find(s => s.originalName === neighborSeatInfo.student);
                if (neighborStudentObject && neighborStudentObject.isNoNeighbor) {
                    return false;
                }
            }
        }
        return true;
    }

    function generateAssignments(plan, studentsToAssignList, targetSeatIndices) {
        let assignments = {};
        const tempSeatDataForAssignment = JSON.parse(JSON.stringify(plan.seatData));

        targetSeatIndices.forEach(idx => {
            if (tempSeatDataForAssignment[idx]) tempSeatDataForAssignment[idx].student = null;
        });
        for(let i = 0; i < tempSeatDataForAssignment.length; i++) {
            if (!targetSeatIndices.includes(i) && plan.seatData[i]) {
                tempSeatDataForAssignment[i].student = plan.seatData[i].student;
            }
        }


        let unassignedStudents = 0;
        const studentPool = [...studentsToAssignList];
        const studentPairs = [];
        const individuals = [];

        const groupedByName = {};
        studentPool.forEach(s => {
            if (s.groupKey) {
                if (!groupedByName[s.groupKey]) groupedByName[s.groupKey] = [];
                groupedByName[s.groupKey].push(s);
            } else {
                individuals.push(s);
            }
        });
        for (const key in groupedByName) {
            while (groupedByName[key].length >= 2) {
                const s1 = groupedByName[key].shift();
                const s2 = groupedByName[key].shift();
                if (s1.isNoNeighbor && s2.isNoNeighbor) {
                    individuals.push(s1, s2);
                } else {
                    studentPairs.push([s1, s2]);
                }
            }
            individuals.push(...groupedByName[key]);
        }

        studentPairs.sort(() => 0.5 - Math.random());
        let availablePhysicalPairs = [];
        const shuffledTargetIndices = [...targetSeatIndices].sort(() => 0.5 - Math.random());

        if (plan.isCustomLayoutActive) {
            for(let i=0; i < shuffledTargetIndices.length; i++) {
                const idx1 = shuffledTargetIndices[i];
                const originalGridIdx1 = plan.seatData[idx1].originalGridIndex;
                if (originalGridIdx1 === null) continue;

                const col1 = originalGridIdx1 % EDITOR_COLS;
                if (col1 < EDITOR_COLS - 1) {
                    const originalGridIdx2Horizontal = originalGridIdx1 + 1;
                    const idx2 = plan.seatData.findIndex(s => s.originalGridIndex === originalGridIdx2Horizontal);

                    if (idx2 !== -1 && shuffledTargetIndices.includes(idx2) &&
                        tempSeatDataForAssignment[idx1] && tempSeatDataForAssignment[idx1].student === null &&
                        tempSeatDataForAssignment[idx2] && tempSeatDataForAssignment[idx2].student === null) {
                        availablePhysicalPairs.push([idx1, idx2].sort((a,b)=>a-b));
                    }
                }
            }
        } else {
            for(let i=0; i < shuffledTargetIndices.length; i++) {
                const idx1 = shuffledTargetIndices[i];
                if (idx1 % 2 === 0 && shuffledTargetIndices.includes(idx1 + 1) &&
                    tempSeatDataForAssignment[idx1] && tempSeatDataForAssignment[idx1].student === null &&
                    tempSeatDataForAssignment[idx1+1] && tempSeatDataForAssignment[idx1+1].student === null) {
                    availablePhysicalPairs.push([idx1, idx1 + 1]);
                }
            }
        }
        availablePhysicalPairs = [...new Set(availablePhysicalPairs.map(JSON.stringify))].map(JSON.parse);
        availablePhysicalPairs.sort(() => 0.5 - Math.random());


        studentPairs.forEach(pair => {
            let placed = false;
            for (let i = 0; i < availablePhysicalPairs.length; i++) {
                const [pIdx1, pIdx2] = availablePhysicalPairs[i];
                if (tempSeatDataForAssignment[pIdx1] && tempSeatDataForAssignment[pIdx1].student === null &&
                    tempSeatDataForAssignment[pIdx2] && tempSeatDataForAssignment[pIdx2].student === null) {
                    if (canPlaceStudent(pair[0], pIdx1, tempSeatDataForAssignment) && canPlaceStudent(pair[1], pIdx2, tempSeatDataForAssignment)) {
                        tempSeatDataForAssignment[pIdx1].student = pair[0].originalName;
                        tempSeatDataForAssignment[pIdx2].student = pair[1].originalName;
                        if (canPlaceStudent(pair[0], pIdx1, tempSeatDataForAssignment) && canPlaceStudent(pair[1], pIdx2, tempSeatDataForAssignment)) {
                            assignments[pIdx1] = pair[0].originalName;
                            assignments[pIdx2] = pair[1].originalName;
                            availablePhysicalPairs.splice(i, 1);
                            placed = true;
                            break;
                        } else {
                            tempSeatDataForAssignment[pIdx1].student = null;
                            tempSeatDataForAssignment[pIdx2].student = null;
                        }
                    }
                    if (!placed && canPlaceStudent(pair[0], pIdx2, tempSeatDataForAssignment) && canPlaceStudent(pair[1], pIdx1, tempSeatDataForAssignment)) {
                        tempSeatDataForAssignment[pIdx2].student = pair[0].originalName;
                        tempSeatDataForAssignment[pIdx1].student = pair[1].originalName;
                        if (canPlaceStudent(pair[0], pIdx2, tempSeatDataForAssignment) && canPlaceStudent(pair[1], pIdx1, tempSeatDataForAssignment)) {
                            assignments[pIdx2] = pair[0].originalName;
                            assignments[pIdx1] = pair[1].originalName;
                            availablePhysicalPairs.splice(i, 1);
                            placed = true;
                            break;
                        } else {
                            tempSeatDataForAssignment[pIdx1].student = null;
                            tempSeatDataForAssignment[pIdx2].student = null;
                        }
                    }
                }
            }
            if (!placed) individuals.push(...pair);
        });

        individuals.sort(() => 0.5 - Math.random());
        individuals.sort((a,b) => (b.isNoNeighbor ? 1 : 0) - (a.isNoNeighbor ? 1 : 0));


        let remainingSingleSeats = targetSeatIndices.filter(idx => !assignments[idx]).sort(() => 0.5 - Math.random());

        individuals.forEach(student => {
            let placed = false;
            for (let i = 0; i < remainingSingleSeats.length; i++) {
                const seatIdx = remainingSingleSeats[i];
                if (tempSeatDataForAssignment[seatIdx] && tempSeatDataForAssignment[seatIdx].student === null && canPlaceStudent(student, seatIdx, tempSeatDataForAssignment)) {
                    assignments[seatIdx] = student.originalName;
                    tempSeatDataForAssignment[seatIdx].student = student.originalName;
                    remainingSingleSeats.splice(i, 1);
                    placed = true;
                    break;
                }
            }
            if (!placed) unassignedStudents++;
        });

        if (unassignedStudents > 0) {
            messageArea.textContent = `${unassignedStudents} Schüler konnten aufgrund von Regeln oder Platzmangel nicht zugewiesen werden.`;
        }
        return assignments;
    }

    function performFullSeatAssignment(plan) {
        if (plan.finalRandomSeatIndex !== -1) {
            const prevFinalSeatDiv = document.getElementById(`seat-${plan.finalRandomSeatIndex}`);
            if (prevFinalSeatDiv) prevFinalSeatDiv.classList.remove('random-selected-final');
            plan.finalRandomSeatIndex = -1;
        }

        if (plan.NUM_SEATS_EFFECTIVE === 0 && !plan.isCustomLayoutActive) {
            plan.isCustomLayoutActive = true;
            plan.NUM_SEATS_EFFECTIVE = DEFAULT_NUM_SEATS;
            plan.customLayoutSeatDefinitions = [...PREDEFINED_DEFAULT_LAYOUT_SEAT_DEFINITIONS];
            calculateUsedBoundsForPlan(plan);
            initializeSeatDataForPlan(plan);
        }

        const parsedStudents = plan.allParsedStudentsList;
        if (parsedStudents.length === 0) {
            messageArea.textContent = "Bitte Schülernamen für diesen Plan eingeben.";
            plan.seatData.forEach(seat => {
                seat.student = null;
                seat.isMarkedToKeepEmpty = false;
                seat.colorState = 0;
                seat.groupId = null;
                seat.groupStyleType = null;
            });
            renderGridForActivePlan();
            return;
        }

        plan.seatData.forEach(seat => {
            seat.student = null;
            seat.colorState = 0;
            seat.groupId = null;
            seat.groupStyleType = null;
        });

        const allCurrentLayoutSeatIndices = Array.from({ length: plan.NUM_SEATS_EFFECTIVE }, (_, k) => k);
        const indicesToKeepEmpty = plan.seatData
            .map((seat, index) => seat.isMarkedToKeepEmpty ? index : -1)
            .filter(index => index !== -1);

        const targetSeatIndices = allCurrentLayoutSeatIndices.filter(idx => !indicesToKeepEmpty.includes(idx));
        const newAssignments = generateAssignments(plan, parsedStudents, targetSeatIndices);

        for (const seatIndex in newAssignments) {
            plan.seatData[parseInt(seatIndex)].student = newAssignments[seatIndex];
        }

        plan.seatData.forEach(seat => seat.isMarkedToKeepEmpty = false);
        if (plan.planId === activePlanId) {
            const groupsButtonTextSpan = generateGroupsButton.querySelector('span[data-text-content]');
            if (groupsButtonTextSpan) {
                groupsButtonTextSpan.textContent = "Gruppen";
            }
        }
        plan.areGroupsActive = false;

        if (plan.planId === activePlanId) {
            renderGridForActivePlan();
        }
    }


    assignAllButton.addEventListener('click', () => {
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (!activePlan) return;
        parseStudentNamesAndUpdateActivePlan();
        performFullSeatAssignment(activePlan);
    });

    copyPlanButton.addEventListener('click', () => {
        const activePlan = plans.find(p => p.planId === activePlanId);
        const sourcePlan = plans[0];
        if (!activePlan || !sourcePlan || activePlan.planId === sourcePlan.planId) return;

        activePlan.className = sourcePlan.className;
        activePlan.roomName = sourcePlan.roomName;
        activePlan.comment = sourcePlan.comment;
        activePlan.groupSetting = sourcePlan.groupSetting;
        activePlan.isCustomLayoutActive = sourcePlan.isCustomLayoutActive;
        activePlan.customLayoutSeatDefinitions = JSON.parse(JSON.stringify(sourcePlan.customLayoutSeatDefinitions));
        activePlan.NUM_SEATS_EFFECTIVE = sourcePlan.NUM_SEATS_EFFECTIVE;

        if (activePlan.isCustomLayoutActive) {
            calculateUsedBoundsForPlan(activePlan);
        } else {
            activePlan.minUsedRow = 0; activePlan.maxUsedRow = EDITOR_ROWS - 1;
            activePlan.minUsedCol = 0; activePlan.maxUsedCol = EDITOR_COLS - 1;
        }

        initializeSeatDataForPlan(activePlan);

        sourcePlan.seatData.forEach((sourceSeat, sourceSeatIndex) => {
            if (sourceSeat.student) {
                const studentExistsInActivePlan = activePlan.allParsedStudentsList.find(s => s.originalName === sourceSeat.student);
                if (studentExistsInActivePlan) {
                    let targetSeatInActivePlan = null;
                    if (activePlan.isCustomLayoutActive) {
                        targetSeatInActivePlan = activePlan.seatData.find(s => s.originalGridIndex === sourceSeat.originalGridIndex);
                    } else {
                        if (sourceSeatIndex < activePlan.seatData.length) {
                            targetSeatInActivePlan = activePlan.seatData[sourceSeatIndex];
                        }
                    }

                    if (targetSeatInActivePlan) {
                        targetSeatInActivePlan.student = sourceSeat.student;
                        targetSeatInActivePlan.colorState = sourceSeat.colorState;
                        targetSeatInActivePlan.groupId = sourceSeat.groupId;
                        targetSeatInActivePlan.groupStyleType = sourceSeat.groupStyleType;
                        targetSeatInActivePlan.isMarkedToKeepEmpty = sourceSeat.isMarkedToKeepEmpty;
                    }
                }
            } else {
                let targetSeatInActivePlan = null;
                if (activePlan.isCustomLayoutActive) {
                    targetSeatInActivePlan = activePlan.seatData.find(s => s.originalGridIndex === sourceSeat.originalGridIndex);
                } else {
                    if (sourceSeatIndex < activePlan.seatData.length) {
                        targetSeatInActivePlan = activePlan.seatData[sourceSeatIndex];
                    }
                }
                if (targetSeatInActivePlan) {
                    targetSeatInActivePlan.isMarkedToKeepEmpty = sourceSeat.isMarkedToKeepEmpty;
                    targetSeatInActivePlan.colorState = sourceSeat.colorState;
                    targetSeatInActivePlan.groupId = sourceSeat.groupId;
                    targetSeatInActivePlan.groupStyleType = sourceSeat.groupStyleType;
                }
            }
        });

        classNameInput.value = activePlan.className;
        roomNameInput.value = activePlan.roomName;
        commentInput.value = activePlan.comment;
        groupEditorInput.value = activePlan.groupSetting;
        activePlan.areGroupsActive = activePlan.seatData.some(s => s.groupId !== null);
        const groupsButtonTextSpan = generateGroupsButton.querySelector('span[data-text-content]');
        if (groupsButtonTextSpan) {
            groupsButtonTextSpan.textContent = activePlan.areGroupsActive ? "Gr. löschen" : "Gruppen";
        }

        messageArea.textContent = `Raumplan und Sitzordnung von '${sourcePlan.planName}' übernommen.`;
        renderGridForActivePlan();
    });


    // --- Zufallsauswahl ---
    randomSelectButton.addEventListener('click', () => {
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (!activePlan) return;

        if (randomAnimationTimeoutId) {
            clearTimeout(randomAnimationTimeoutId);
        }

        if (activePlan.finalRandomSeatIndex !== -1) {
            const prevFinalSeatDiv = document.getElementById(`seat-${activePlan.finalRandomSeatIndex}`);
            if (prevFinalSeatDiv) prevFinalSeatDiv.classList.remove('random-selected-final');
            activePlan.finalRandomSeatIndex = -1;
        }
        if (currentRandomHighlightIndex !== -1) {
            const prevAnimSeatDiv = document.getElementById(`seat-${currentRandomHighlightIndex}`);
            if (prevAnimSeatDiv) prevAnimSeatDiv.classList.remove('random-highlight-animation');
            currentRandomHighlightIndex = -1;
        }

        const availableSeatsForRandom = activePlan.seatData
            .map((seat, index) => !seat.isMarkedToKeepEmpty ? index : -1)
            .filter(index => index !== -1);

        if (availableSeatsForRandom.length === 0) {
            messageArea.textContent = "Keine Plätze für Zufallsauswahl verfügbar (alle sind als 'freihalten' markiert).";
            return;
        }

        assignAllButton.disabled = true;
        generateGroupsButton.disabled = true;
        savePlanButton.disabled = true;
        loadPlanButton.disabled = true;
        downloadPdfButton.disabled = true;
        randomSelectButton.disabled = true;
        toggleRoomEditorButton.disabled = true;


        let startTime = Date.now();
        const duration = 5000;
        let nextTimeout = 50;
        const maxTimeout = 450;

        function animateStep() {
            const elapsedTime = Date.now() - startTime;

            if (currentRandomHighlightIndex !== -1) {
                const prevSeatDiv = document.getElementById(`seat-${currentRandomHighlightIndex}`);
                if (prevSeatDiv) prevSeatDiv.classList.remove('random-highlight-animation');
            }

            if (elapsedTime < duration) {
                const randomIndexInAvailable = Math.floor(Math.random() * availableSeatsForRandom.length);
                currentRandomHighlightIndex = availableSeatsForRandom[randomIndexInAvailable];

                const currentSeatDiv = document.getElementById(`seat-${currentRandomHighlightIndex}`);
                if (currentSeatDiv) currentSeatDiv.classList.add('random-highlight-animation');

                const progress = elapsedTime / duration;
                nextTimeout = 50 + Math.pow(progress, 3) * (maxTimeout - 50);
                if (nextTimeout > maxTimeout) nextTimeout = maxTimeout;

                randomAnimationTimeoutId = setTimeout(animateStep, nextTimeout);
            } else {
                activePlan.finalRandomSeatIndex = currentRandomHighlightIndex;
                if (activePlan.finalRandomSeatIndex !== -1) {
                    const finalSeatDiv = document.getElementById(`seat-${activePlan.finalRandomSeatIndex}`);
                    if (finalSeatDiv) {
                        finalSeatDiv.classList.remove('random-highlight-animation');
                        finalSeatDiv.classList.add('random-selected-final');
                    }
                }

                assignAllButton.disabled = false;
                generateGroupsButton.disabled = false;
                savePlanButton.disabled = false;
                loadPlanButton.disabled = false;
                downloadPdfButton.disabled = false;
                randomSelectButton.disabled = false;
                toggleRoomEditorButton.disabled = false;
                currentRandomHighlightIndex = -1;
                randomAnimationTimeoutId = null;
            }
        }
        animateStep();
    });


    // --- Speicher- und Ladefunktionen ---
    savePlanButton.addEventListener('click', () => {
        updateActivePlanDataFromUI();

        const dataToSave = {
            plans: plans,
            activePlanId: activePlanId
        };
        const dataStr = JSON.stringify(dataToSave, null, 2);
        const dataBlob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(dataBlob);

        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = 'sitzplan_daten_alle_plaene.json';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
        messageArea.textContent = "Alle Pläne gespeichert.";
    });

    loadPlanButton.addEventListener('click', () => {
        loadFileInput.click();
    });

    loadFileInput.addEventListener('change', (event) => {
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (activePlan && activePlan.finalRandomSeatIndex !== -1) {
            const prevFinalSeatDiv = document.getElementById(`seat-${activePlan.finalRandomSeatIndex}`);
            if (prevFinalSeatDiv) prevFinalSeatDiv.classList.remove('random-selected-final');
            activePlan.finalRandomSeatIndex = -1;
        }

        const file = event.target.files[0];
        if (!file) { return; }
        if (!file.name.endsWith('.json')) {
            messageArea.textContent = "Fehler: Bitte eine .json Datei auswählen.";
            loadFileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const loadedFileData = JSON.parse(e.target.result);
                if (loadedFileData && Array.isArray(loadedFileData.plans) && loadedFileData.activePlanId) {
                    plans = loadedFileData.plans;
                    plans.forEach(plan => {
                        plan.comment = plan.comment || "";
                        plan.groupSetting = plan.groupSetting || "";
                        plan.isCustomLayoutActive = plan.isCustomLayoutActive || false;
                        plan.customLayoutSeatDefinitions = plan.customLayoutSeatDefinitions || [];
                        plan.NUM_SEATS_EFFECTIVE = plan.NUM_SEATS_EFFECTIVE || (plan.isCustomLayoutActive ? plan.customLayoutSeatDefinitions.length : DEFAULT_NUM_SEATS);
                        if (plan.isCustomLayoutActive) {
                            calculateUsedBoundsForPlan(plan);
                        } else {
                            plan.minUsedRow = 0; plan.maxUsedRow = EDITOR_ROWS - 1;
                            plan.minUsedCol = 0; plan.maxUsedCol = EDITOR_COLS - 1;
                        }
                        plan.areGroupsActive = plan.seatData.some(seat => seat.groupId !== null);
                        plan.finalRandomSeatIndex = plan.finalRandomSeatIndex || -1;
                    });
                    setActivePlan(loadedFileData.activePlanId);
                    messageArea.textContent = "Pläne erfolgreich geladen.";
                } else {
                    throw new Error("Ungültiges Dateiformat oder fehlende Daten.");
                }
            } catch (error) {
                console.error("Fehler beim Laden der Datei:", error);
                messageArea.textContent = `Fehler beim Laden: ${error.message}`;
            } finally {
                loadFileInput.value = '';
            }
        };
        reader.onerror = () => {
            messageArea.textContent = "Fehler beim Lesen der Datei.";
            loadFileInput.value = '';
        }
        reader.readAsText(file);
    });

    // --- Gruppenbildung ---
    function parseGroupInputFromEditor() {
        const input = groupEditorInput.value.trim().toLowerCase();
        if (!input) return null;

        if (input.startsWith('g')) {
            const size = parseInt(input.substring(1));
            if (!isNaN(size) && size > 0) {
                return { type: 'size', value: size };
            }
        } else {
            const count = parseInt(input);
            if (!isNaN(count) && count > 0) {
                return { type: 'count', value: count };
            }
        }
        return null;
    }

    function createGroupColorSwatches() {
        groupEditorColorSwatchesDiv.innerHTML = '';

        const fillSwatchesRow = document.createElement('div');
        fillSwatchesRow.classList.add('color-swatch-row');

        const stripesSwatchesRow = document.createElement('div');
        stripesSwatchesRow.classList.add('color-swatch-row');
        stripesSwatchesRow.style.marginTop = '0.5rem';

        for (let i = 0; i < GROUP_COLORS_COUNT; i++) {
            const swatchFill = document.createElement('div');
            swatchFill.classList.add('color-swatch', `group-fill-${i}`);
            swatchFill.draggable = true;
            swatchFill.dataset.groupId = i;
            swatchFill.dataset.groupStyleType = 'fill';
            swatchFill.addEventListener('dragstart', handleDragStart);
            fillSwatchesRow.appendChild(swatchFill);

            const swatchStripes = document.createElement('div');
            swatchStripes.classList.add('color-swatch', `group-stripes-${i}`);
            swatchStripes.draggable = true;
            swatchStripes.dataset.groupId = i;
            swatchStripes.dataset.groupStyleType = 'stripes';
            swatchStripes.addEventListener('dragstart', handleDragStart);
            stripesSwatchesRow.appendChild(swatchStripes);
        }

        groupEditorColorSwatchesDiv.appendChild(fillSwatchesRow);
        groupEditorColorSwatchesDiv.appendChild(stripesSwatchesRow);
    }


    // KORREKTUR: Vereinfachte Logik zum Umschalten der Sichtbarkeit
    generateGroupsButton.addEventListener('click', () => {
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (!activePlan) return;
        const groupsButtonTextSpan = generateGroupsButton.querySelector('span[data-text-content]');

        if (activePlan.areGroupsActive) {
            // Logik zum Löschen von Gruppen
            activePlan.seatData.forEach(seat => {
                seat.groupId = null;
                seat.groupStyleType = null;
            });
            if (groupsButtonTextSpan) groupsButtonTextSpan.textContent = "Gruppen";
            activePlan.areGroupsActive = false;
            groupEditorContainer.classList.add('hidden');
            renderGridForActivePlan();
            messageArea.textContent = "Gruppen gelöscht.";
        } else {
            // Logik zum Öffnen des Gruppen-Editors
            // Zuerst das andere Panel sicher ausblenden
            roomEditorContainer.classList.add('hidden');
            toggleRoomEditorButton.querySelector('span[data-text-content]').textContent = "Raumeditor";

            // Gruppen-Editor anzeigen
            groupEditorContainer.classList.remove('hidden');
            createGroupColorSwatches();
            if (groupsButtonTextSpan) groupsButtonTextSpan.textContent = "Gr. löschen";
        }
    });

    closeGroupEditorButton.addEventListener('click', () => {
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (!activePlan) return;
        const groupsButtonTextSpan = generateGroupsButton.querySelector('span[data-text-content]');
        if (groupsButtonTextSpan) {
            groupsButtonTextSpan.textContent = activePlan.areGroupsActive ? "Gr. löschen" : "Gruppen";
        }
        groupEditorContainer.classList.add('hidden');
    });

    generateRandomGroupsButton.addEventListener('click', () => {
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (!activePlan) return;

        const groupParams = parseGroupInputFromEditor();
        if (!groupParams) {
            messageArea.textContent = "Ungültige Eingabe für Gruppen. Z.B. '4' für Anzahl oder 'G3' für Größe.";
            return;
        }

        if (activePlan.finalRandomSeatIndex !== -1) {
            const prevFinalSeatDiv = document.getElementById(`seat-${activePlan.finalRandomSeatIndex}`);
            if (prevFinalSeatDiv) prevFinalSeatDiv.classList.remove('random-selected-final');
            activePlan.finalRandomSeatIndex = -1;
        }

        activePlan.seatData.forEach(seat => {
            seat.colorState = 0;
            seat.groupId = null;
            seat.groupStyleType = null;
        });

        const occupiedSeatIndices = activePlan.seatData
            .map((seat, index) => (seat.student && !seat.isMarkedToKeepEmpty) ? index : -1)
            .filter(index => index !== -1);

        if (occupiedSeatIndices.length === 0) {
            messageArea.textContent = "Keine belegten Plätze für Gruppenbildung vorhanden.";
            renderGridForActivePlan();
            return;
        }

        let shuffledOccupiedIndices = [...occupiedSeatIndices].sort(() => 0.5 - Math.random());
        let currentGroupIdCycle = 0;
        let groupMembers = [];

        if (groupParams.type === 'count') {
            const numGroups = groupParams.value;
            if (numGroups <= 0) {
                messageArea.textContent = "Anzahl der Gruppen muss größer als 0 sein.";
                return;
            }
            const baseGroupSize = Math.floor(shuffledOccupiedIndices.length / numGroups);
            let remainder = shuffledOccupiedIndices.length % numGroups;

            let studentIdx = 0;
            for (let i = 0; i < numGroups; i++) {
                groupMembers[i] = [];
                const currentGroupActualSize = baseGroupSize + (remainder > 0 ? 1 : 0);
                for (let j = 0; j < currentGroupActualSize; j++) {
                    if (studentIdx < shuffledOccupiedIndices.length) {
                        const seatIndex = shuffledOccupiedIndices[studentIdx];
                        activePlan.seatData[seatIndex].groupId = i;
                        groupMembers[i].push(seatIndex);
                        studentIdx++;
                    }
                }
                if (remainder > 0) remainder--;
            }

        } else if (groupParams.type === 'size') {
            const groupSize = groupParams.value;
            if (groupSize <= 0) {
                messageArea.textContent = "Gruppengröße muss größer als 0 sein.";
                return;
            }
            for (let i = 0; i < shuffledOccupiedIndices.length; i++) {
                if (i % groupSize === 0) {
                    currentGroupIdCycle = Math.floor(i / groupSize);
                    groupMembers[currentGroupIdCycle] = [];
                }
                const seatIndex = shuffledOccupiedIndices[i];
                activePlan.seatData[seatIndex].groupId = currentGroupIdCycle;
                groupMembers[currentGroupIdCycle].push(seatIndex);
            }
        }

        const totalNumGroupsFormed = groupMembers.length;
        groupMembers.forEach((membersInGroup, grpId) => {
            let style;
            if (totalNumGroupsFormed <= GROUP_COLORS_COUNT) {
                style = 'fill';
            } else {
                const styleTypeDeterminer = Math.floor(grpId / 8);
                style = (styleTypeDeterminer % 2 === 0) ? 'fill' : 'stripes';
            }
            membersInGroup.forEach(seatIdx => {
                activePlan.seatData[seatIdx].groupStyleType = style;
            });
        });

        activePlan.areGroupsActive = true;
        const groupsButtonTextSpan = generateGroupsButton.querySelector('span[data-text-content]');
        if (groupsButtonTextSpan) {
            groupsButtonTextSpan.textContent = "Gr. löschen";
        }
        renderGridForActivePlan();
    });

    insertTestClassButton.addEventListener('click', () => {
        const activePlan = plans.find(p => p.planId === activePlanId);
        if (!activePlan) return;

        const maleNames = ["Max Mustermann", "Tom Mustermann", "Paul Mustermann", "Leon Mustermann", "Finn Mustermann", "Noah Mustermann", "Elias Mustermann", "Ben Mustermann", "Luca Mustermann", "Felix Mustermann", "Jonas Mustermann", "Louis Mustermann", "Anton Mustermann", "Emil Mustermann", "Oskar Mustermann"];
        const femaleNames = ["Erika Musterfrau", "Anna Musterfrau", "Mia Musterfrau", "Emma Musterfrau", "Sophia Musterfrau", "Hannah Musterfrau", "Emilia Musterfrau", "Lina Musterfrau", "Marie Musterfrau", "Clara Musterfrau", "Lea Musterfrau", "Lena Musterfrau", "Laura Musterfrau", "Sarah Musterfrau", "Ida Musterfrau"];
        const testStudents = maleNames.concat(femaleNames);

        studentNamesTextarea.value = testStudents.join(',\n');
        parseStudentNamesAndUpdateActivePlan();

        classNameInput.value = "Testklasse";
        roomNameInput.value = "Raum 00";
        commentInput.value = "Testplan";
        updateActivePlanDataFromUI();

        if (activePlan.NUM_SEATS_EFFECTIVE === 0 && !activePlan.isCustomLayoutActive) {
            activePlan.isCustomLayoutActive = true;
            activePlan.NUM_SEATS_EFFECTIVE = DEFAULT_NUM_SEATS;
            activePlan.customLayoutSeatDefinitions = [...PREDEFINED_DEFAULT_LAYOUT_SEAT_DEFINITIONS];
            calculateUsedBoundsForPlan(activePlan);
            initializeSeatDataForPlan(activePlan);
        }

        performFullSeatAssignment(activePlan);
        messageArea.textContent = "Testklasse eingefügt und Plätze zugewiesen.";
    });


    // --- PDF Download Funktion ---
    downloadPdfButton.addEventListener('click', () => {
        if (!jsPDF) {
            messageArea.textContent = "PDF-Funktion ist nicht verfügbar.";
            return;
        }
        updateActivePlanDataFromUI();

        if (plans.length === 0 || plans.every(p => p.NUM_SEATS_EFFECTIVE === 0)) {
            messageArea.textContent = "Bitte erstelle oder lade mindestens einen Plan mit Sitzen, um ein PDF zu generieren.";
            return;
        }

        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });
        const pageWidth = doc.internal.pageSize.getWidth();

        const pdfScaleFactor = 1.5;
        const baseFontSize = 8;
        const classFontSize = 12;
        const roomFontSize = 10;
        const commentFontSize = 8;
        const dateTimeFontSize = 7;
        const planNameFontSize = 14;


        plans.forEach((currentPlan, planIndex) => {
            if (planIndex > 0) {
                doc.addPage();
            }
            if (currentPlan.NUM_SEATS_EFFECTIVE === 0) return;

            let yOffsetForDetails = 12 + (2 * pdfScaleFactor);

            doc.setFontSize(planNameFontSize * pdfScaleFactor);
            doc.text(currentPlan.planName, 14, yOffsetForDetails);
            yOffsetForDetails += (planNameFontSize * pdfScaleFactor * 0.352778 / 2) + 5;

            if (currentPlan.className) {
                doc.setFontSize(classFontSize * pdfScaleFactor);
                doc.text(`Klasse: ${currentPlan.className}`, 14, yOffsetForDetails);
                yOffsetForDetails += (classFontSize * pdfScaleFactor * 0.352778 / 2) + 3;
            }
            if (currentPlan.roomName) {
                doc.setFontSize(roomFontSize * pdfScaleFactor);
                doc.text(`Raum: ${currentPlan.roomName}`, 14, yOffsetForDetails);
                yOffsetForDetails += (roomFontSize * pdfScaleFactor * 0.352778 / 2) + 3;
            }
            if (currentPlan.comment) {
                doc.setFontSize(commentFontSize * pdfScaleFactor);
                const commentLines = doc.splitTextToSize(`Kommentar: ${currentPlan.comment}`, pageWidth - 28 - 50);
                doc.text(commentLines, 14, yOffsetForDetails);
                yOffsetForDetails += (commentLines.length * commentFontSize * pdfScaleFactor * 0.352778 / 2) + 3;
            }


            doc.setFontSize(dateTimeFontSize * pdfScaleFactor);
            const now = new Date();
            const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            const dateTimeFullStr = `${dateStr} - ${timeStr} Uhr`;
            doc.text(dateTimeFullStr, pageWidth - 14, 12 + (2 * pdfScaleFactor), { align: 'right' });


            doc.setFontSize(baseFontSize * pdfScaleFactor);

            const pdfSeatWidth = 20 * pdfScaleFactor;
            const pdfSeatHeight = 15 * pdfScaleFactor;
            const pdfPairInternalGap = 2 * pdfScaleFactor;
            const pdfGapBetweenPairs = 3 * pdfScaleFactor;
            const pdfCentralGap = 10 * pdfScaleFactor;
            const pdfRowToRowGap = 7 * pdfScaleFactor;
            const pdfDeskHeight = pdfSeatHeight;

            const pairBlockWidth = pdfSeatWidth * 2 + pdfPairInternalGap;
            const halfRowWidth = pairBlockWidth * 2 + pdfGapBetweenPairs;
            const totalSeatLayoutWidthDefault = halfRowWidth * 2 + pdfCentralGap;
            const pdfDeskWidth = halfRowWidth;

            let layoutStartX = (pageWidth - totalSeatLayoutWidthDefault) / 2;
            let yPosForRow = yOffsetForDetails + 5;

            if (currentPlan.isCustomLayoutActive) {
                const numActiveCols = (currentPlan.maxUsedCol - currentPlan.minUsedCol + 1);
                let customPdfSeatWidth = Math.min(pdfSeatWidth, (pageWidth - 28 - ((numActiveCols -1) * pdfGapBetweenPairs)) / numActiveCols) ;
                customPdfSeatWidth = Math.max(customPdfSeatWidth, 15 * pdfScaleFactor);

                const customPdfSeatHeight = customPdfSeatWidth * (pdfSeatHeight / pdfSeatWidth);
                const totalCustomWidth = numActiveCols * customPdfSeatWidth + (numActiveCols - 1) * pdfGapBetweenPairs;
                layoutStartX = (pageWidth - totalCustomWidth) / 2;
                let currentX = layoutStartX;

                for (let r = currentPlan.minUsedRow; r <= currentPlan.maxUsedRow; r++) {
                    currentX = layoutStartX;
                    for (let c = currentPlan.minUsedCol; c <= currentPlan.maxUsedCol; c++) {
                        const editorGridIdx = r * EDITOR_COLS + c;
                        const seatInfo = currentPlan.seatData.find(sd => sd.originalGridIndex === editorGridIdx);
                        if (seatInfo) {
                            drawSeatOnPdf(doc, currentX, yPosForRow, customPdfSeatWidth, customPdfSeatHeight, seatInfo, pdfScaleFactor, currentPlan.allParsedStudentsList);
                        }
                        currentX += customPdfSeatWidth + pdfGapBetweenPairs;
                    }
                    yPosForRow += customPdfSeatHeight + pdfRowToRowGap;
                }
                yPosForRow -= pdfRowToRowGap;
            } else {
                for (let r = 0; r < 4; r++) {
                    let currentX = layoutStartX;
                    // Linke Hälfte der Reihe
                    for (let p = 0; p < DEFAULT_PAIRS_PER_ROW / 2; p++) {
                        const seat1Idx = r * DEFAULT_SEATS_PER_ROW + p * DEFAULT_SEATS_PER_PAIR;
                        const seat2Idx = seat1Idx + 1;
                        if(currentPlan.seatData[seat1Idx]) drawSeatOnPdf(doc, currentX, yPosForRow, pdfSeatWidth, pdfSeatHeight, currentPlan.seatData[seat1Idx], pdfScaleFactor, currentPlan.allParsedStudentsList);
                        currentX += pdfSeatWidth + pdfPairInternalGap;
                        if(currentPlan.seatData[seat2Idx]) drawSeatOnPdf(doc, currentX, yPosForRow, pdfSeatWidth, pdfSeatHeight, currentPlan.seatData[seat2Idx], pdfScaleFactor, currentPlan.allParsedStudentsList);
                        currentX += pdfSeatWidth + pdfGapBetweenPairs;
                    }

                    currentX = layoutStartX + halfRowWidth + pdfCentralGap;

                    // Rechte Hälfte der Reihe
                    for (let p = DEFAULT_PAIRS_PER_ROW / 2; p < DEFAULT_PAIRS_PER_ROW; p++) {
                        const seat1Idx = r * DEFAULT_SEATS_PER_ROW + p * DEFAULT_SEATS_PER_PAIR;
                        const seat2Idx = seat1Idx + 1;
                        if(currentPlan.seatData[seat1Idx]) drawSeatOnPdf(doc, currentX, yPosForRow, pdfSeatWidth, pdfSeatHeight, currentPlan.seatData[seat1Idx], pdfScaleFactor, currentPlan.allParsedStudentsList);
                        currentX += pdfSeatWidth + pdfPairInternalGap;
                        if(currentPlan.seatData[seat2Idx]) drawSeatOnPdf(doc, currentX, yPosForRow, pdfSeatWidth, pdfSeatHeight, currentPlan.seatData[seat2Idx], pdfScaleFactor, currentPlan.allParsedStudentsList);
                        currentX += pdfSeatWidth + pdfGapBetweenPairs;
                    }
                    yPosForRow += pdfSeatHeight + pdfRowToRowGap;
                }
            }

            const deskX = (pageWidth - pdfDeskWidth) / 2;
            const deskY = yPosForRow + (5 * pdfScaleFactor);

            doc.setFillColor(203, 213, 225);
            doc.setDrawColor(148, 163, 184);
            doc.rect(deskX, deskY, pdfDeskWidth, pdfDeskHeight, 'FD');
            doc.setTextColor(51, 65, 85);
            doc.setFontSize(10 * pdfScaleFactor);
            doc.text("Pult", deskX + pdfDeskWidth / 2, deskY + pdfDeskHeight / 2, { align: 'center', baseline: 'middle' });
        });

        doc.save('sitzplan.pdf');
    });

    function drawSeatOnPdf(doc, x, y, w, h, seatInfo, scaleFactor, planStudentList) {
        const originalDrawColor = doc.getDrawColor();
        const originalLineWidth = doc.getLineWidth();

        doc.setDrawColor(209, 213, 219);
        doc.setLineWidth(0.2 * scaleFactor);
        doc.setFillColor(243, 244, 246);

        const groupPdfFillColors = [
            [255,0,0], [42,26,255], [250,255,0], [0,255,10], [255,0,153],
            [141,26,255], [0,255,224], [201,119,0], [0,109,23], [141,141,141]
        ];
        const groupPdfBorderColors = [
            [204,0,0], [14,0,204], [200,204,0], [0,204,8], [204,0,122],
            [113,0,204], [0,204,179], [161,95,0], [0,87,18], [100,100,100]
        ];

        let isGroupBorderNeededForPdf = false;

        if (seatInfo.groupId !== null) {
            const colorIndex = seatInfo.groupId % GROUP_COLORS_COUNT;
            doc.setFillColor(...groupPdfFillColors[colorIndex]);

            if (seatInfo.groupStyleType === 'stripes') {
                isGroupBorderNeededForPdf = true;
            }
        } else if (seatInfo.colorState === 1) {
            doc.setFillColor(167, 243, 208);
        } else if (seatInfo.colorState === 2) {
            doc.setFillColor(253, 230, 138);
        } else if (seatInfo.colorState === 3) {
            doc.setFillColor(254, 202, 202);
        } else {
            if (seatInfo.student) {
                doc.setFillColor(219, 234, 254);
            }
        }
        doc.rect(x, y, w, h, 'FD');

        if (isGroupBorderNeededForPdf) {
            const colorIndex = seatInfo.groupId % GROUP_COLORS_COUNT;
            doc.setDrawColor(...groupPdfBorderColors[colorIndex]);
            doc.setLineWidth(1 * scaleFactor);
            doc.rect(x, y, w, h, 'S');
        }

        if (seatInfo.isMarkedToKeepEmpty) {
            doc.setDrawColor(249, 115, 22);
            doc.setLineWidth(1.2 * scaleFactor);
            doc.rect(x, y, w, h, 'S');
        }


        doc.setTextColor(0, 0, 0);
        const fontSize = 6 * scaleFactor;
        doc.setFontSize(fontSize);

        let studentNameToDisplay = "Frei";
        if (seatInfo.student) {
            const studentObject = planStudentList.find(s => s.originalName === seatInfo.student);
            studentNameToDisplay = studentObject ? studentObject.displayName : seatInfo.student.replace(/[\d*]+$/, '').trim();
        }

        const maxWidth = w - (3.5 * scaleFactor);
        let finalLines = [];

        if (studentNameToDisplay === "Frei" || studentNameToDisplay.trim() === "") {
            finalLines = ["Frei"];
        } else {
            const words = studentNameToDisplay.trim().split(/\s+/);
            let linesForThisName = [];

            if (words.length > 1) {
                const firstWord = words[0];
                const restOfName = words.slice(1).join(' ');

                linesForThisName = doc.splitTextToSize(firstWord, maxWidth);
                if (restOfName.trim().length > 0) {
                    linesForThisName = linesForThisName.concat(doc.splitTextToSize(restOfName, maxWidth));
                }
            } else {
                linesForThisName = doc.splitTextToSize(studentNameToDisplay.trim(), maxWidth);
            }
            finalLines = linesForThisName;
        }

        finalLines = finalLines.filter(line => line.trim().length > 0);
        if (finalLines.length === 0 && studentNameToDisplay.trim() !== "" && studentNameToDisplay !== "Frei") {
            finalLines = doc.splitTextToSize(studentNameToDisplay.trim(), maxWidth);
        }
        if (finalLines.length === 0 && studentNameToDisplay === "Frei") {
            finalLines = ["Frei"];
        }

        const approxLineHeight = 2.2 * scaleFactor * (fontSize / 6);
        const verticalPadding = 1.5 * scaleFactor;
        const maxLinesAllowed = Math.max(1, Math.floor((h - verticalPadding * 2) / approxLineHeight));

        if (finalLines.length > maxLinesAllowed) {
            const originalLength = finalLines.length;
            finalLines = finalLines.slice(0, maxLinesAllowed);
            if (finalLines.length > 0 && originalLength > maxLinesAllowed) {
                let lastLineIdx = finalLines.length - 1;
                let lastLineContent = finalLines[lastLineIdx];
                if (lastLineContent.length > 3) {
                    finalLines[lastLineIdx] = lastLineContent.substring(0, lastLineContent.length - 2) + "..";
                } else {
                    finalLines[lastLineIdx] = "..";
                }
            }
        }

        if(finalLines.length === 0 && studentNameToDisplay.trim() !== "" && studentNameToDisplay !== "Frei") {
            finalLines.push("...");
        }
        if(finalLines.length === 0 && studentNameToDisplay === "Frei") {
            finalLines.push("Frei");
        }

        if (seatInfo.groupId !== null) {
            const colorIndex = seatInfo.groupId % GROUP_COLORS_COUNT;
            const rgbFill = groupPdfFillColors[colorIndex];
            let textColor = [0,0,0];

            if (seatInfo.groupStyleType === 'stripes') {
                if (colorIndex === 1 || colorIndex === 5 || colorIndex === 8) {
                    textColor = [255,255,255];
                } else {
                    textColor = [0,0,0];
                }
            } else {
                const luminance = (0.299 * rgbFill[0] + 0.587 * rgbFill[1] + 0.114 * rgbFill[2]) / 255;
                if (luminance > 0.5 && !(colorIndex === 2 || colorIndex === 3 || colorIndex === 6)) {
                    textColor = [0,0,0];
                } else if (luminance <= 0.5 || (colorIndex === 2 || colorIndex === 3 || colorIndex === 6)) {
                    if (colorIndex === 2 || colorIndex === 3 || colorIndex === 6) textColor = [0,0,0];
                    else textColor = [255,255,255];
                }
            }
            doc.setTextColor(...textColor);

        } else if (seatInfo.colorState === 1) { doc.setTextColor(6,95,70);
        } else if (seatInfo.colorState === 2) { doc.setTextColor(146,64,14);
        } else if (seatInfo.colorState === 3) { doc.setTextColor(153,27,27);
        } else if (seatInfo.student) { doc.setTextColor(30,64,175);
        } else { doc.setTextColor(107,114,128);
        }


        doc.text(finalLines, x + w / 2, y + h / 2, { align: 'center', baseline: 'middle' });

        doc.setDrawColor(originalDrawColor[0], originalDrawColor[1], originalDrawColor[2]);
        doc.setLineWidth(originalLineWidth);
    }

    // Initialisierung beim Laden der Seite
    addTabButton.addEventListener('click', addTab);
    addTab();

    // --- Dark Mode ---
    const darkModeToggleButton = document.getElementById('darkModeToggleButton');
    const currentTheme = localStorage.getItem('theme');

    if (currentTheme === 'dark') {
        document.body.classList.add('dark-mode');
        darkModeToggleButton.textContent = '☀️';
    } else {
        darkModeToggleButton.textContent = '🌙';
    }

    darkModeToggleButton.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        let theme = 'light';
        if (document.body.classList.contains('dark-mode')) {
            theme = 'dark';
            darkModeToggleButton.textContent = '☀️';
        } else {
            darkModeToggleButton.textContent = '🌙';
        }
        localStorage.setItem('theme', theme);
    });
});
