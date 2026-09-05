/**
 * Prüfdiagramme für die Modellierungsschicht.
 *
 * Bewusst klein und handgeschrieben: die Korpusdateien in `test/corpus` decken
 * das *Lesen* ab (52 Dateien, siehe ROUNDTRIP-REPORT). Zum Prüfen von
 * Operationen braucht es dagegen Diagramme, deren Struktur man im Test benennen
 * kann — „die Aufgabe in Lane 2 des unteren Pools" muss ein Bezeichner sein,
 * kein Suchvorgang. Der Korpuslauf am Ende der Testdatei benutzt trotzdem echte
 * Dateien.
 */

export const SIMPLE_PROCESS = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Antrag geht ein">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Task_1" name="Antrag pruefen">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="Gateway_1" name="Vollstaendig?" default="Flow_3">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:endEvent id="EndEvent_1" name="Antrag entschieden">
      <bpmn:incoming>Flow_3</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="Task_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Task_1" targetRef="Gateway_1" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Gateway_1" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1">
    <bpmndi:BPMNPlane id="Plane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="160" y="180" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="140" y="223" width="80" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_1_di" bpmnElement="Task_1">
        <dc:Bounds x="250" y="158" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_1_di" bpmnElement="Gateway_1" isMarkerVisible="true">
        <dc:Bounds x="405" y="173" width="50" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1">
        <dc:Bounds x="512" y="180" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1">
        <di:waypoint x="196" y="198" />
        <di:waypoint x="250" y="198" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2">
        <di:waypoint x="350" y="198" />
        <di:waypoint x="405" y="198" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_3_di" bpmnElement="Flow_3">
        <di:waypoint x="455" y="198" />
        <di:waypoint x="512" y="198" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/** Aufgabe mit angeheftetem Boundary Event und ausgehendem Fehlerpfad. */
export const BOUNDARY_PROCESS = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_2" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_2" isExecutable="false">
    <bpmn:serviceTask id="Task_A" name="Bonitaet abrufen">
      <bpmn:outgoing>Flow_A</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:boundaryEvent id="Boundary_1" name="Zeit" attachedToRef="Task_A">
      <bpmn:outgoing>Flow_B</bpmn:outgoing>
      <bpmn:timerEventDefinition id="Timer_1" />
    </bpmn:boundaryEvent>
    <bpmn:endEvent id="End_A"><bpmn:incoming>Flow_A</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="End_B"><bpmn:incoming>Flow_B</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_A" sourceRef="Task_A" targetRef="End_A" />
    <bpmn:sequenceFlow id="Flow_B" sourceRef="Boundary_1" targetRef="End_B" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_2">
    <bpmndi:BPMNPlane id="Plane_2" bpmnElement="Process_2">
      <bpmndi:BPMNShape id="Task_A_di" bpmnElement="Task_A">
        <dc:Bounds x="200" y="120" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Boundary_1_di" bpmnElement="Boundary_1">
        <dc:Bounds x="262" y="182" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_A_di" bpmnElement="End_A">
        <dc:Bounds x="400" y="142" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="End_B_di" bpmnElement="End_B">
        <dc:Bounds x="400" y="280" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_A_di" bpmnElement="Flow_A">
        <di:waypoint x="300" y="160" /><di:waypoint x="400" y="160" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_B_di" bpmnElement="Flow_B">
        <di:waypoint x="280" y="218" /><di:waypoint x="280" y="298" /><di:waypoint x="400" y="298" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/** Zwei Pools, drei Lanes, ein Nachrichtenfluss, ein aufgeklappter Subprozess. */
export const COLLABORATION = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_3" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collaboration_1">
    <bpmn:participant id="Pool_A" name="Fachbereich" processRef="Process_A" />
    <bpmn:participant id="Pool_B" name="Dienstleister" processRef="Process_B" />
    <bpmn:messageFlow id="Message_1" name="Auftrag" sourceRef="Task_A1" targetRef="Task_B1" />
  </bpmn:collaboration>
  <bpmn:process id="Process_A" isExecutable="false">
    <bpmn:laneSet id="LaneSet_A">
      <bpmn:lane id="Lane_A1" name="Sachbearbeitung">
        <bpmn:flowNodeRef>Start_A</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_A1</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_A2" name="Leitung">
        <bpmn:flowNodeRef>Sub_A</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:startEvent id="Start_A"><bpmn:outgoing>Flow_A1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="Task_A1" name="Auftrag erstellen">
      <bpmn:incoming>Flow_A1</bpmn:incoming>
      <bpmn:outgoing>Flow_A2</bpmn:outgoing>
    </bpmn:task>
    <bpmn:subProcess id="Sub_A" name="Freigabe">
      <bpmn:incoming>Flow_A2</bpmn:incoming>
      <bpmn:startEvent id="Sub_Start"><bpmn:outgoing>Sub_Flow</bpmn:outgoing></bpmn:startEvent>
      <bpmn:endEvent id="Sub_End"><bpmn:incoming>Sub_Flow</bpmn:incoming></bpmn:endEvent>
      <bpmn:sequenceFlow id="Sub_Flow" sourceRef="Sub_Start" targetRef="Sub_End" />
    </bpmn:subProcess>
    <bpmn:sequenceFlow id="Flow_A1" sourceRef="Start_A" targetRef="Task_A1" />
    <bpmn:sequenceFlow id="Flow_A2" sourceRef="Task_A1" targetRef="Sub_A" />
  </bpmn:process>
  <bpmn:process id="Process_B" isExecutable="false">
    <bpmn:laneSet id="LaneSet_B">
      <bpmn:lane id="Lane_B1" name="Annahme">
        <bpmn:flowNodeRef>Task_B1</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:task id="Task_B1" name="Auftrag annehmen" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_3">
    <bpmndi:BPMNPlane id="Plane_3" bpmnElement="Collaboration_1">
      <bpmndi:BPMNShape id="Pool_A_di" bpmnElement="Pool_A" isHorizontal="true">
        <dc:Bounds x="120" y="60" width="700" height="300" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_A1_di" bpmnElement="Lane_A1" isHorizontal="true">
        <dc:Bounds x="150" y="60" width="670" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_A2_di" bpmnElement="Lane_A2" isHorizontal="true">
        <dc:Bounds x="150" y="210" width="670" height="150" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Start_A_di" bpmnElement="Start_A">
        <dc:Bounds x="200" y="117" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_A1_di" bpmnElement="Task_A1">
        <dc:Bounds x="290" y="95" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_A_di" bpmnElement="Sub_A" isExpanded="true">
        <dc:Bounds x="290" y="230" width="350" height="120" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_Start_di" bpmnElement="Sub_Start">
        <dc:Bounds x="320" y="272" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Sub_End_di" bpmnElement="Sub_End">
        <dc:Bounds x="560" y="272" width="36" height="36" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Pool_B_di" bpmnElement="Pool_B" isHorizontal="true">
        <dc:Bounds x="120" y="420" width="700" height="200" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_B1_di" bpmnElement="Lane_B1" isHorizontal="true">
        <dc:Bounds x="150" y="420" width="670" height="200" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_B1_di" bpmnElement="Task_B1">
        <dc:Bounds x="290" y="480" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_A1_di" bpmnElement="Flow_A1">
        <di:waypoint x="236" y="135" /><di:waypoint x="290" y="135" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_A2_di" bpmnElement="Flow_A2">
        <di:waypoint x="340" y="175" /><di:waypoint x="340" y="230" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Sub_Flow_di" bpmnElement="Sub_Flow">
        <di:waypoint x="356" y="290" /><di:waypoint x="560" y="290" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Message_1_di" bpmnElement="Message_1">
        <di:waypoint x="340" y="175" /><di:waypoint x="340" y="480" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/** Prozess mit Datenobjekt und Textannotation. */
export const DATA_PROCESS = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_4" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_4" isExecutable="false">
    <bpmn:task id="Task_D" name="Beleg buchen" />
    <bpmn:dataObjectReference id="Data_1" name="Beleg" dataObjectRef="DataObject_1" />
    <bpmn:dataObject id="DataObject_1" />
    <bpmn:textAnnotation id="Note_1"><bpmn:text>Vier-Augen-Prinzip</bpmn:text></bpmn:textAnnotation>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_4">
    <bpmndi:BPMNPlane id="Plane_4" bpmnElement="Process_4">
      <bpmndi:BPMNShape id="Task_D_di" bpmnElement="Task_D">
        <dc:Bounds x="200" y="120" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Data_1_di" bpmnElement="Data_1">
        <dc:Bounds x="232" y="260" width="36" height="50" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Note_1_di" bpmnElement="Note_1">
        <dc:Bounds x="400" y="100" width="120" height="40" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/**
 * Pool mit **geschachtelten** Lanes (`childLaneSet`).
 *
 * Der Bestandskorpus enthält keinen solchen Fall — er ist der Grund, warum die
 * Geometrie geschachtelter Lanes im ersten Durchgang offen blieb. Zwei Ebenen
 * genügen, um die Fragen zu stellen, auf die es ankommt: Auf welcher Ebene
 * hängt `flowNodeRef`, und welcher Container ändert seine Größe, wenn eine
 * innere Lane verschwindet?
 */
export const NESTED_LANES = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_5" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:collaboration id="Collab_5">
    <bpmn:participant id="Pool_N" name="Haus" processRef="Process_N" />
  </bpmn:collaboration>
  <bpmn:process id="Process_N" isExecutable="false">
    <bpmn:laneSet id="LaneSet_N">
      <bpmn:lane id="Lane_Aussen" name="Bereich">
        <bpmn:childLaneSet id="LaneSet_Innen">
          <bpmn:lane id="Lane_Innen1" name="Team A">
            <bpmn:flowNodeRef>Task_N1</bpmn:flowNodeRef>
          </bpmn:lane>
          <bpmn:lane id="Lane_Innen2" name="Team B">
            <bpmn:flowNodeRef>Task_N2</bpmn:flowNodeRef>
          </bpmn:lane>
        </bpmn:childLaneSet>
      </bpmn:lane>
      <bpmn:lane id="Lane_Unten" name="Leitung">
        <bpmn:flowNodeRef>Task_N3</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>
    <bpmn:task id="Task_N1" name="Erfassen" />
    <bpmn:task id="Task_N2" name="Pruefen" />
    <bpmn:task id="Task_N3" name="Freigeben" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_5">
    <bpmndi:BPMNPlane id="Plane_5" bpmnElement="Collab_5">
      <bpmndi:BPMNShape id="Pool_N_di" bpmnElement="Pool_N" isHorizontal="true">
        <dc:Bounds x="100" y="100" width="700" height="300" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Aussen_di" bpmnElement="Lane_Aussen" isHorizontal="true">
        <dc:Bounds x="130" y="100" width="670" height="200" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Innen1_di" bpmnElement="Lane_Innen1" isHorizontal="true">
        <dc:Bounds x="160" y="100" width="640" height="100" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Innen2_di" bpmnElement="Lane_Innen2" isHorizontal="true">
        <dc:Bounds x="160" y="200" width="640" height="100" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Lane_Unten_di" bpmnElement="Lane_Unten" isHorizontal="true">
        <dc:Bounds x="130" y="300" width="670" height="100" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_N1_di" bpmnElement="Task_N1">
        <dc:Bounds x="250" y="110" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_N2_di" bpmnElement="Task_N2">
        <dc:Bounds x="250" y="210" width="100" height="80" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Task_N3_di" bpmnElement="Task_N3">
        <dc:Bounds x="250" y="310" width="100" height="80" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
