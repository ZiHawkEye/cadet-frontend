import { NonIdealState, Spinner } from '@blueprintjs/core';
import { IconNames } from '@blueprintjs/icons';
import * as React from 'react';

import { InterpreterOutput, IWorkspaceState } from '../../reducers/states';
import { history } from '../../utils/history';
import { assessmentCategoryLink } from '../../utils/paramParseHelpers';
import {
  retrieveLocalAssessment,
  storeLocalAssessment,
  storeLocalAssessmentOverview
} from '../../utils/xmlParser';
import {
  IAssessment,
  IAssessmentOverview,
  IMCQQuestion,
  IProgrammingQuestion,
  IQuestion,
  Library,
  QuestionTypes
} from '../assessment/assessmentShape';
import Workspace, { WorkspaceProps } from '../workspace';
import { ControlBarProps } from '../workspace/ControlBar';
import { SideContentProps } from '../workspace/side-content';
import ToneMatrix from '../workspace/side-content/ToneMatrix';
import {
  DeploymentTab,
  GradingTab,
  ManageQuestionTab,
  QuestionTemplateTab,
  TextareaContentTab
} from './editingWorkspaceSideContent';
import HelpTab from './editingWorkspaceSideContent/HelpTab';

export type AssessmentWorkspaceProps = DispatchProps & OwnProps & StateProps;

export type StateProps = {
  activeTab: number;
  assessment?: IAssessment;
  editorValue: string | null;
  editorWidth: string;
  hasUnsavedChanges: boolean;
  isRunning: boolean;
  output: InterpreterOutput[];
  replValue: string;
  sideContentHeight?: number;
  storedAssessmentId?: number;
  storedQuestionId?: number;
};

export type OwnProps = {
  assessmentId: number;
  questionId: number;
  assessmentOverview: IAssessmentOverview;
  updateAssessmentOverview: (overview: IAssessmentOverview) => void;
  listingPath?: string;
  notAttempted: boolean;
  closeDate: string;
};

export type DispatchProps = {
  handleBrowseHistoryDown: () => void;
  handleBrowseHistoryUp: () => void;
  handleChapterSelect: (chapter: any, changeEvent: any) => void;
  handleClearContext: (library: Library) => void;
  handleEditorEval: () => void;
  handleEditorValueChange: (val: string) => void;
  handleEditorWidthChange: (widthChange: number) => void;
  handleInterruptEval: () => void;
  handleReplEval: () => void;
  handleReplOutputClear: () => void;
  handleReplValueChange: (newValue: string) => void;
  handleResetWorkspace: (options: Partial<IWorkspaceState>) => void;
  handleSave: (id: number, answer: number | string) => void;
  handleSideContentHeightChange: (heightChange: number) => void;
  handleUpdateCurrentAssessmentId: (assessmentId: number, questionId: number) => void;
  handleUpdateHasUnsavedChanges: (hasUnsavedChanges: boolean) => void;
};

interface IState {
  assessment: IAssessment | null;
  activeTab: number;
  hasUnsavedChanges: boolean;
  originalMaxGrade: number;
  originalMaxXp: number;
}

class AssessmentWorkspace extends React.Component<AssessmentWorkspaceProps, IState> {
  public constructor(props: AssessmentWorkspaceProps) {
    super(props);
    this.state = {
      assessment: retrieveLocalAssessment(),
      activeTab: 0,
      hasUnsavedChanges: false,
      originalMaxGrade: 0,
      originalMaxXp: 0
    };
  }

  /**
   * After mounting (either an older copy of the assessment
   * or a loading screen), try to fetch a newer assessment,
   * and show the briefing.
   */
  public componentDidMount() {
    const assessment = this.state.assessment;
    if (assessment) {
      this.setState({
        originalMaxGrade: assessment.questions[this.props.questionId].maxGrade,
        originalMaxXp: assessment.questions[this.props.questionId].maxXp
      });
    }
  }

  /**
   * Once there is an update (due to the assessment being fetched), check
   * if a workspace reset is needed.
   */
  public componentDidUpdate() {
    this.checkWorkspaceReset(this.props);
  }

  public render() {
    if (this.state.assessment === null || this.state.assessment!.questions.length === 0) {
      return (
        <NonIdealState
          className="WorkspaceParent pt-dark"
          description="Getting mission ready..."
          visual={<Spinner large={true} />}
        />
      );
    }
    /* If questionId is out of bounds, set it to the max. */
    const questionId =
      this.props.questionId >= this.state.assessment.questions.length
        ? this.state.assessment.questions.length - 1
        : this.props.questionId;
    const question: IQuestion = this.state.assessment.questions[questionId];
    const editorValue =
      question.type === QuestionTypes.programming
        ? question.answer !== null
          ? ((question as IProgrammingQuestion).answer as string)
          : (question as IProgrammingQuestion).solutionTemplate
        : null;
    const workspaceProps: WorkspaceProps = {
      controlBarProps: this.controlBarProps(this.props, questionId),
      editorProps:
        question.type === QuestionTypes.programming
          ? {
              editorValue: editorValue!,
              handleEditorEval: this.props.handleEditorEval,
              handleEditorValueChange: this.props.handleEditorValueChange,
              handleUpdateHasUnsavedChanges: this.props.handleUpdateHasUnsavedChanges
            }
          : undefined,
      editorWidth: this.props.editorWidth,
      handleEditorWidthChange: this.props.handleEditorWidthChange,
      handleSideContentHeightChange: this.props.handleSideContentHeightChange,
      hasUnsavedChanges: this.state.hasUnsavedChanges,
      mcqProps: {
        mcq: question as IMCQQuestion,
        handleMCQSubmit: (option: number) =>
          this.props.handleSave(this.state.assessment!.questions[questionId].id, option)
      },
      sideContentHeight: this.props.sideContentHeight,
      sideContentProps: this.sideContentProps(this.props, questionId),
      replProps: {
        handleBrowseHistoryDown: this.props.handleBrowseHistoryDown,
        handleBrowseHistoryUp: this.props.handleBrowseHistoryUp,
        handleReplEval: this.props.handleReplEval,
        handleReplValueChange: this.props.handleReplValueChange,
        output: this.props.output,
        replValue: this.props.replValue
      }
    };
    return (
      <div className="WorkspaceParent pt-dark">
        <Workspace {...workspaceProps} />
      </div>
    );
  }

  /**
   * Checks if there is a need to reset the workspace, then executes
   * a dispatch (in the props) if needed.
   */
  private checkWorkspaceReset(props: AssessmentWorkspaceProps) {
    /* Don't reset workspace if assessment not fetched yet. */
    if (this.state.assessment === undefined) {
      return;
    }

    /* Reset assessment if it has changed.*/
    const assessmentId = this.props.assessmentId;
    const questionId = this.props.questionId;

    if (
      this.props.storedAssessmentId !== assessmentId ||
      this.props.storedQuestionId !== questionId
    ) {
      const question = this.state.assessment!.questions[questionId];
      const library =
        question.library.chapter === -1
          ? this.state.assessment!.globalDeployment!
          : question.library;
      const editorValue =
        question.type === QuestionTypes.programming
          ? question.answer !== null
            ? ((question as IProgrammingQuestion).answer as string)
            : (question as IProgrammingQuestion).solutionTemplate
          : null;
      this.props.handleUpdateCurrentAssessmentId(assessmentId, questionId);
      this.props.handleResetWorkspace({ editorValue });
      this.props.handleClearContext(library);
      this.props.handleUpdateHasUnsavedChanges(false);
      if (editorValue) {
        this.props.handleEditorValueChange(editorValue);
      }
      if (this.state.hasUnsavedChanges) {
        this.setState({
          assessment: retrieveLocalAssessment(),
          hasUnsavedChanges: false
        });
      }
      this.setState({
        activeTab: 0,
        originalMaxGrade: question.maxGrade,
        originalMaxXp: question.maxXp
      });
    }
  }

  private handleSave = () => {
    this.setState({
      hasUnsavedChanges: false
    });
    storeLocalAssessment(this.state.assessment!);
    this.handleSaveGradeAndXp();
  };

  private handleSaveGradeAndXp = () => {
    const assessment = this.state.assessment!;
    const curGrade = assessment.questions[this.props.questionId].maxGrade;
    const changeGrade = curGrade - this.state.originalMaxGrade;
    const curXp = assessment.questions[this.props.questionId].maxXp;
    const changeXp = curXp - this.state.originalMaxXp;
    if (changeGrade !== 0 || changeXp !== 0) {
      const overview = this.props.assessmentOverview;
      if (changeGrade !== 0) {
        overview.maxGrade += changeGrade;
      }
      if (changeXp !== 0) {
        overview.maxXp += changeXp;
      }
      this.setState({
        originalMaxGrade: curGrade,
        originalMaxXp: curXp
      });
      this.props.updateAssessmentOverview(overview);
      storeLocalAssessmentOverview(overview);
    }
  };

  private updateEditAssessmentState = (assessmentVal: IAssessment) => {
    this.setState({
      assessment: assessmentVal,
      hasUnsavedChanges: true
    });
  };

  private updateAndSaveAssessment = (assessmentVal: IAssessment) => {
    this.setState({
      assessment: assessmentVal
    });
    this.handleSave();
  };

  private handleChangeActiveTab = (tab: number) => {
    this.setState({
      activeTab: tab
    });
  };

  /** Pre-condition: IAssessment has been loaded */
  private sideContentProps: (p: AssessmentWorkspaceProps, q: number) => SideContentProps = (
    props: AssessmentWorkspaceProps,
    questionId: number
  ) => {
    const assessment = this.state.assessment!;
    const tabs = [
      {
        label: `${assessment!.category} Briefing`,
        icon: IconNames.BRIEFCASE,
        body: (
          <TextareaContentTab
            assessment={assessment}
            path={['longSummary']}
            updateAssessment={this.updateEditAssessmentState}
          />
        )
      },
      {
        label: `Add/Delete Questions`,
        icon: IconNames.WRENCH,
        body: (
          <ManageQuestionTab
            assessment={assessment}
            questionId={questionId}
            updateAssessment={this.updateAndSaveAssessment}
          />
        )
      },
      {
        label: `Manage Global Deployment`,
        icon: IconNames.GLOBE,
        body: (
          <DeploymentTab
            assessment={assessment}
            pathToLibrary={['globalDeployment']}
            updateAssessment={this.updateEditAssessmentState}
            isGlobalDeployment={true}
          />
        )
      },
      {
        label: `Help`,
        icon: IconNames.HELP,
        body: (
          <HelpTab />
        )
      },
      {
        label: `Task ${questionId + 1}`,
        icon: IconNames.NINJA,
        body: (
          <TextareaContentTab
            assessment={assessment}
            path={['questions', questionId, 'content']}
            updateAssessment={this.updateEditAssessmentState}
          />
        )
      },
      {
        label: `Question Template`,
        icon: IconNames.DOCUMENT,
        body: (
          <QuestionTemplateTab
            assessment={assessment}
            questionId={questionId}
            updateAssessment={this.updateEditAssessmentState}
          />
        )
      },
      {
        label: `Manage Local Deployment`,
        icon: IconNames.HOME,
        body: (
          <DeploymentTab
            assessment={assessment}
            pathToLibrary={['questions', questionId, 'library']}
            updateAssessment={this.updateEditAssessmentState}
            isGlobalDeployment={false}
          />
        )
      }
    ];
    const isGraded = assessment!.questions[questionId].grader !== null;
    if (isGraded) {
      tabs.push({
        label: `Grading`,
        icon: IconNames.TICK,
        body: (
          <GradingTab
            assessment={assessment}
            path={['questions', questionId]}
            updateAssessment={this.updateEditAssessmentState}
          />
        )
      });
    }

    const functionsAttached = assessment!.questions[questionId].library.external.symbols;
    if (functionsAttached.includes('get_matrix')) {
      tabs.push({
        label: `Tone Matrix`,
        icon: IconNames.GRID_VIEW,
        body: <ToneMatrix />
      });
    }
    return {
      activeTab: this.state.activeTab,
      handleChangeActiveTab: this.handleChangeActiveTab,
      tabs
    };
  };

  /** Pre-condition: IAssessment has been loaded */
  private controlBarProps: (p: AssessmentWorkspaceProps, q: number) => ControlBarProps = (
    props: AssessmentWorkspaceProps,
    questionId: number
  ) => {
    const listingPath =
      this.props.listingPath ||
      `/academy/${assessmentCategoryLink(this.state.assessment!.category)}`;
    const assessmentWorkspacePath = listingPath + `/${this.state.assessment!.id.toString()}`;
    return {
      externalLibraryName: this.state.assessment!.questions[questionId].library.external.name,
      handleEditorEval: this.props.handleEditorEval,
      handleInterruptEval: this.props.handleInterruptEval,
      handleReplEval: this.props.handleReplEval,
      handleReplOutputClear: this.props.handleReplOutputClear,
      handleReplValueChange: this.props.handleReplValueChange,
      hasChapterSelect: false,
      hasEditorAutorunButton: false,
      hasSaveButton: true,
      hasShareButton: false,
      isRunning: this.props.isRunning,
      onClickNext: () => history.push(assessmentWorkspacePath + `/${(questionId + 1).toString()}`),
      onClickPrevious: () =>
        history.push(assessmentWorkspacePath + `/${(questionId - 1).toString()}`),
      onClickReturn: () => history.push(listingPath),
      onClickSave: this.handleSave,
      questionProgress: [questionId + 1, this.state.assessment!.questions.length],
      sourceChapter: this.state.assessment!.questions[questionId].library.chapter
    };
  };
}

export default AssessmentWorkspace;
