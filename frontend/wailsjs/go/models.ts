export namespace db {
	
	export class HistoryLog {
	    index: number;
	    actionName: string;
	    timestamp: number;
	
	    static createFrom(source: any = {}) {
	        return new HistoryLog(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.index = source["index"];
	        this.actionName = source["actionName"];
	        this.timestamp = source["timestamp"];
	    }
	}
	export class Project {
	    id: number;
	    name: string;
	    content: string;
	    createdAt: number;
	    updatedAt: number;
	
	    static createFrom(source: any = {}) {
	        return new Project(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.content = source["content"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	    }
	}

}

