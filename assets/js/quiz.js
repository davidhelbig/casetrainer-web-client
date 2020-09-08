import {Backend} from "./api.js"
import {diffChars} from "./jsdiff/character.js"
import {config} from "./config.js"

const api = new Backend;
api.setBaseUrl(config.baseUrl);

// initialize some DOM elements
const form = document.querySelector("#input-form");
const selectionForm = document.querySelector("#selection-form")
const input = document.querySelector("#answer-input");
const statusSection = document.querySelector("#status-section");
const apiErrorMessage = "An error occurred while trying to get data from the API. Please try again later.";
const scoreElement = document.querySelector("#score");

const NUM_TO_FETCH = 10;

// map the noun gender element from the API to a more friendly form with emojis
const genderMapping = {
    "m inan": "male inanimate (" + String.fromCodePoint(0x2642) + ")",
    "m anim": "male animate (" + String.fromCodePoint(0x2642) + String.fromCodePoint(0x1F493) + ")",
    "m pers": "male personal (" + String.fromCodePoint(0x1F468) + ")",
    f: "female" + String.fromCodePoint(0x2640),
    n: "neuter" + String.fromCodePoint(0x2753)
}

function getDiff(userAnswer, correct) {
    let color = '';
    let span = null;

    const diff = diffChars(userAnswer, correct),
    fragment = document.createDocumentFragment();

    diff.forEach((part) => {
        // green for additions, red for deletions
        // grey for common parts
        const color = part.added ? 'green' :
            part.removed ? 'red' : 'grey';
        span = document.createElement('span');
        span.style.color = color;
        span.appendChild(document
            .createTextNode(part.value));
        fragment.appendChild(span);
        });

    return fragment;
}

class Quiz {
    constructor (selection) {
        this.selection = selection;
        this.score = {
            correct: 0,
            wrong: 0,
            total: 0
        }

    }

    /**
     * Gets a new Promise from the question API     
     * @param  {Object}  queryData   An object that defines the cases and numbers for which
     *                               data will be retrieved
     * @return {Promise}             Promise that contains the question element retrieved by the API
     */
    async getQuestions (num) {
        // retrieve JSON-data via Backend method

        try {
            // ad the num-parameter to the "selection" (and thus to the query string)
            const query = {...this.selection, ...{num}};
            const questionsJson = await api.get("questions", query);
            console.log(`Fetched ${questionsJson.length} new questions.`);

            let questions = [];

            questionsJson.forEach(question => {
                questions.push(new Question(question));
            });
            return questions;
        } catch(error) {
            // reject the promise
            console.log(error)
            throw error;
        }
    }

    showScore () {
        const percentage = (this.score.correct/this.score.total) * 100
        scoreElement.textContent = `Score: ${percentage.toFixed(2)}% (${this.score.correct}/${this.score.total})`;
    }

    /**
     * Checks the question attribute (the current question) against the user input.
     * Modify the DOM accordingly to give feedback to the user and update the score attribute
     */
    evaluateQuestion (question)  {
        const userAnswer = input.value.trim();
        statusSection.innerHTML = "";

        if (question.answerIsCorrect(userAnswer)) {
            statusSection.textContent = "Correct! 👍";
            input.classList.add("good");
            this.score.correct += 1;
        } else {
            input.classList.add("warn");
            const statusSectionHTML = `<div>That wasn't quite right! 🙁</div><div>Target: ${question.targetCase} ${question.targetNumber}</div><div>Correct: ${question.answerText}</div><div>Your answer: ${userAnswer}</div>`
            const diffFragment = getDiff(userAnswer, question.answerText);
            statusSection.innerHTML = statusSectionHTML;
            statusSection.appendChild(diffFragment);
            this.score.wrong += 1;
        }
        this.score.total += 1;

    }
}

class Question  {
    /**
     * @param  {Object} questionAPIData The body of the question API response
     */
    constructor (questionAPIData) {
        this.nounBaseForm = questionAPIData.question_elements.noun_base_form;
        this.adjBaseForm =  questionAPIData.question_elements.adj_base_form;
        this.nounGender = genderMapping[questionAPIData.question_elements.noun_gender];
        this.targetNumber = questionAPIData.question_elements.target_number;
        this.targetCase = questionAPIData.question_elements.target_case;

        this.answerText = questionAPIData.answer_elements.noun_correct + " " + questionAPIData.answer_elements.adj_correct;
    }

    /**
     * Show the question in the DOM
     */
    showQuestion() {
        document.querySelector("#noun-base-value").textContent = this.nounBaseForm;
        document.querySelector("#adj-base-value").textContent = this.adjBaseForm;
        document.querySelector("#noun-gender").textContent = this.nounGender;
        document.querySelector("#target-number").textContent = this.targetNumber;
        document.querySelector("#target-case").textContent = this.targetCase;
    }

    /**
     * @param  {String} userAnswer  the answer provided by the user
     * @return {Boolean}            return whether the answer was correct or not
     */
    answerIsCorrect (userAnswer) {

        if (userAnswer === this.answerText) {
            return true;
        } else {
            return false;
        }

    }

}


/**
 * @param  {Element} form The form element from which the selection will be constructed
 */
function getSelectionFromForm(form) {
    const formData = new FormData(form);
    const selection = {numbers: [], cases: []};
    for(var pair of formData.entries()) {
        if (pair[0] == "cases") {
            selection.cases.push(pair[1]);
        } else if (pair[0] == "numbers") {
            selection.numbers.push(pair[1]);
        }
    }
    if (selection.numbers.length < 1 || selection.cases.length < 1) {
        const selectionErrorMessage = "Invalid. Please select at least one number and one case!";
        statusSection.innerHTML = selectionErrorMessage;
        return false;
    }
    return selection;
}

function validateInput() {
    if (input.value == "") {
        setTimeout(() => {
            statusSection.innerHTML = "Please enter your answer in the input field!"
        }, 1000);
        return false;
    } else {
        return true;
    }
}



selectionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const selection = getSelectionFromForm(event.currentTarget);

    // if selection cannot be loaded or is invalid, early exit
    if (!selection) {
        return false;
    }

    const quiz = new Quiz(selection);

    // get questions from the api

    try {
        quiz.questions = await quiz.getQuestions(NUM_TO_FETCH);
    } catch {
        statusSection.innerHTML = apiErrorMessage;
        document.querySelector("#confirm-selection-button").setAttribute("disabled", "disabled");
        return false;
    }

    let question = quiz.questions.shift();
    if (!question) {
        return false;
    }

    // "remove" the case/number-selection area and show the trainer area
    document.querySelector("#trainer-area").classList.remove("invisible");
    document.querySelector("#case-selection-area").classList.add("invisible");
    statusSection.innerHTML = "";

    question.showQuestion();

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (!validateInput()) {
            return false;
        }

        // evaluate the current question
        quiz.evaluateQuestion(question);
        quiz.showScore();

        
        // reset input text field
        setTimeout(() => {
            input.value = "";
            input.classList = "";
        },1000)

        // check the number of available questions, retrieve new ones if necessary
        if (quiz.questions.length === 0) {
            try {
                quiz.questions = await quiz.getQuestions(NUM_TO_FETCH);
            } catch {
                statusSection.innerHTML = apiErrorMessage;
                document.querySelector("#confirm-answer-button").setAttribute("disabled", "disabled");
                return false;
            }
        }
        // pop a new question
        question = quiz.questions.shift();

        // show the new question
        question.showQuestion();

    });
});