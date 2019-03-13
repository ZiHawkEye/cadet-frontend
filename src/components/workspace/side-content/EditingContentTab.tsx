import { Card } from '@blueprintjs/core'
import * as React from 'react'
import AceEditor from 'react-ace'
import Textarea from 'react-textarea-autosize';

import {
  IAssessment,
  IMCQQuestion,
} from '../../assessment/assessmentShape'
import Markdown from '../../commons/Markdown'
import { mcqTemplate, programmingTemplate } from '../../missionControl/assessmentTemplates';

interface IProps {
	assessment: IAssessment,
	path: Array<string | number>,
	type: string,
	updateAssessment: (assessment: IAssessment) => void,
}

interface IState {
	editingAssessmentPath: string,
	fieldValue: string,
}

export class EditingContentTab extends React.Component<IProps, IState> {

  public constructor(props: IProps) {
    super(props)
    this.state = {
      editingAssessmentPath: '',
      fieldValue:'',
    }
  }

  public render() {
  	const display = (
  		this.props.type === 'content' ?
  			this.contentTab(this.props.path!)
  		: this.props.type === 'questionTemplate' ?
  			this.questionTemplateTab()
  		: this.props.type === 'grading' ?
  			this.gradingTab()
      : this.props.type === 'manageQuestions' ?
        this.manageQuestionTab()
      : null
  	);

  	return display;
  }

  private manageQuestionTab = () => {
    return <div>
      <button onClick={this.makeProgramming}>Make Programming Question</button>
      <button onClick={this.makeMCQ}>Make MCQ Question</button>
      <button onClick={this.deleteQn}>Delete Question</button>
      </div>
  }

  private makeProgramming = () => {
    const assessment = this.props.assessment;
    const path = [this.props.path[0]];
    const index = (path[1] as number) + 1;
    let questions = getValueFromPath(path, assessment);
    questions = questions.slice(0, index).concat([programmingTemplate]).concat(questions.slice(index));
    assignToPath(path, questions, assessment);
    this.props.updateAssessment(assessment);
  }

  private makeMCQ = () => {
    const assessment = this.props.assessment;
    const path = [this.props.path[0]];
    const index = (path[1] as number) + 1;
    let questions = getValueFromPath(path, assessment);
    questions = (questions.slice(0, index)).concat([mcqTemplate]).concat(questions.slice(index));
    assignToPath(path, questions, assessment);
    this.props.updateAssessment(assessment);
  }

  private deleteQn = () => {
    const assessment = this.props.assessment;
    const path = this.props.path;
    let questions = getValueFromPath([path[0]], assessment);
    const index = path[1] as number;
    if (questions.length > 1) {
      questions = questions.slice(0, index).concat(questions.slice(index + 1));
    } 
    assignToPath([path[0]], questions, assessment);
    this.props.updateAssessment(assessment);
  }

  private saveEditAssessment = (
    path: Array<string | number>,
    isString: boolean = true
  ) => 
  () => 
  (e: any) => {
    const fieldValue = (isString) ? this.state.fieldValue : parseInt(this.state.fieldValue, 10);
    const assessmentVal = this.props.assessment;
    assignToPath(path, fieldValue, assessmentVal);
    this.setState({
      editingAssessmentPath: '',
      fieldValue:''
    });
    this.props.updateAssessment(assessmentVal);
  }

  private handleEditAssessment = () => (e: any) =>{
    this.setState({
      fieldValue:e.target.value
    })
  }

  private handleTemplateChange = (path: Array<string | number>) => (newCode: string) =>{
    const assessmentVal = this.props.assessment;
    assignToPath(path, newCode, assessmentVal);
    this.setState({
      editingAssessmentPath: '',
      fieldValue:'',
    })
    this.props.updateAssessment(assessmentVal);
  }

  private toggleEditField = (path: Array<string | number>) => (e: any) => {
    const stringPath = path.join("/");
    const fieldVal = getValueFromPath(path, this.props.assessment) || '';
    this.setState({
      editingAssessmentPath: stringPath,
      fieldValue: (typeof fieldVal === "string") ? fieldVal : fieldVal.toString()
    })
  }

  private makeEditingTextarea = (
    handleOnBlur: () => (e: any) => void
  ) => 
    <Textarea
      autoFocus={true}
      className={'editing-textarea'}
      onChange={this.handleEditAssessment()}
      onBlur={handleOnBlur()}
      value={this.state.fieldValue}
    />

  private mcqTab = (questionId: number) => {
    const question = this.props.assessment!.questions[questionId] as IMCQQuestion;
    const mcqButton = question.choices.map((choice, i) => (
      <div key={i} className="mcq-option col-xs-12">
        Option {i}:
        {this.contentTab(
          ["questions", questionId, "choices", i, "content"],
          "Enter Option here"
        )}
        <br/>
        Hint:
        {this.contentTab(
          ["questions", questionId, "choices", i, "hint"],
          "Enter Hint here"
        )}
      </div>
    ))

    return ( 
      <div className="MCQChooser row">
        <Card className="mcq-content-parent col-xs-12 middle-xs">
          <div className="row mcq-options-parent between-xs">
            {mcqButton}
            Solution: 
            {this.contentTab(
              ["questions", questionId, "solution"],
              "Enter Solution Here",
              false
            )}
          </div>
        </Card>
      </div>
    )
  }

  private programmingTab = (path: Array<string | number>) => (
    <AceEditor
      className="react-ace"
      editorProps={{
        $blockScrolling: Infinity
      }}
      fontSize={14}
      highlightActiveLine={false}
      mode="javascript"
      onChange={this.handleTemplateChange(path)}
      theme="cobalt"
      value={getValueFromPath(path, this.props.assessment)}
    />
  )

  private questionTemplateTab = () =>{
  	const questionId = this.props.path[1] as number; 
    // tslint:disable-next-line:no-console
    // console.dir(this.props.assessment)
    const type = this.props.assessment!.questions[questionId].type;
    const display = 
      (type === 'mcq') ?
        this.mcqTab(questionId)
      : 
        this.programmingTab(this.props.path.concat(["answer"]));

    return display;
  }

  private contentTab = (
    path: Array<string | number>, 
    filler: string = 'Enter Value',
    isString: boolean = true 
  ) =>{ 
    const pathString = path.join("/");
    const value = getValueFromPath(path, this.props.assessment);
    return (
      <div onClick={this.toggleEditField(path)}>
        {this.state.editingAssessmentPath === pathString ? (
          this.makeEditingTextarea(this.saveEditAssessment(path, isString))
        ) : (
          isString ? 
            <Markdown content={value || filler} />
          :
            value
        )}
      </div>
    )
  }

  private gradingTab = () => (
	  <div>
	    Max Grade:
	    {this.contentTab(
	      this.props.path.concat(["maxGrade"]),
	      "Max Grade",
	      false
	    )}
	    <br/>
	    Max Xp: 
	    {this.contentTab(
	      this.props.path.concat(["maxXp"]),
	      "Max Xp",
	      false
	    )}
	  </div>
  )

}

const getValueFromPath = (path: Array<string | number>, obj: any) : any => {
  for (const next of path) {
    obj = obj[next];
  }
  return obj;
}

const assignToPath: any = (path: Array<string | number>, value: any, obj: any,) : void => {
  let i = 0;
  for (i = 0; i < path.length - 1; i++) {
    obj = obj[path[i]];
  }
  obj[path[i]] = value;
}

export default EditingContentTab;